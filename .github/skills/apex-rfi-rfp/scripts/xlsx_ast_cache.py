#!/usr/bin/env python3
"""Deterministic fail-closed Excel AST formula evaluator, <v> cache injector, and OOXML verifier.

Evaluates a bounded, documented subset of Excel formulas on ``openpyxl`` workbooks,
resolves worksheet XML paths via ``xl/workbook.xml`` and ``xl/_rels/workbook.xml.rels``,
injects typed ``<v>`` cached values, enforces Desktop Excel's ``<=255``-character
header/footer limit, and verifies non-destructive customer template preservation.
"""

from __future__ import annotations

import argparse
import copy
import fnmatch
import io
import itertools
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from decimal import (
    ROUND_CEILING,
    ROUND_DOWN,
    ROUND_FLOOR,
    ROUND_HALF_UP,
    ROUND_UP,
    Decimal,
    InvalidOperation,
)
from pathlib import Path, PurePosixPath
from typing import Any
from xml.etree import ElementTree as ET

import openpyxl
from openpyxl.formula.translate import Translator
from openpyxl.utils import column_index_from_string, get_column_letter
from openpyxl.worksheet.formula import ArrayFormula, DataTableFormula

try:
    from ._safe_io import (
        ContainmentError,
        open_validated_zip,
        parse_safe_xml_bytes,
        read_safe_zip_bytes,
        validate_archive_member_name,
    )
except ImportError:
    _SCRIPT_DIR = str(Path(__file__).resolve().parent)
    if _SCRIPT_DIR not in sys.path:
        sys.path.insert(0, _SCRIPT_DIR)
    from _safe_io import (  # type: ignore[no-redef]
        ContainmentError,
        open_validated_zip,
        parse_safe_xml_bytes,
        read_safe_zip_bytes,
        validate_archive_member_name,
    )

NS_SPREADSHEET_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_SPREADSHEET_STRICT = "http://purl.oclc.org/ooxml/spreadsheetml/main"
NS_OFFICE_RELS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_OFFICE_RELS_STRICT = "http://purl.oclc.org/ooxml/officeDocument/relationships"
NS_PACKAGE_RELS = "http://schemas.openxmlformats.org/package/2006/relationships"

MAX_EXCEL_ROW = 1_048_576
MAX_EXCEL_COL = 16_384
MAX_HEADER_FOOTER_CHARS = 255
MAX_RANGE_EVAL_CELLS = 250_000
MAX_TOTAL_RANGE_EVAL_CELLS = 1_000_000
MAX_FORMULA_CELLS_PER_WORKBOOK = 200_000

HEADER_FOOTER_TAGS: tuple[str, ...] = (
    "oddHeader",
    "oddFooter",
    "evenHeader",
    "evenFooter",
    "firstHeader",
    "firstFooter",
)

EXCEL_ERROR_TOKENS: frozenset[str] = frozenset(
    {
        "#REF!",
        "#NAME?",
        "#VALUE!",
        "#DIV/0!",
        "#N/A",
        "#NUM!",
        "#NULL!",
        "#SPILL!",
        "#CALC!",
        "#GETTING_DATA",
    }
)

SUPPORTED_FUNCTIONS: frozenset[str] = frozenset(
    {
        "ABS",
        "AND",
        "AVERAGE",
        "CEILING",
        "CHOOSE",
        "COUNT",
        "COUNTA",
        "COUNTIF",
        "FLOOR",
        "IF",
        "IFERROR",
        "IFS",
        "INDEX",
        "INT",
        "ISBLANK",
        "ISNUMBER",
        "ISTEXT",
        "LEN",
        "LOWER",
        "MATCH",
        "MAX",
        "MIN",
        "MOD",
        "NOT",
        "OR",
        "ROUND",
        "ROUNDDOWN",
        "ROUNDUP",
        "SUM",
        "SUMIF",
        "SUMIFS",
        "SUMPRODUCT",
        "TEXT",
        "TRIM",
        "UPPER",
    }
)


class UnsupportedFormulaError(ValueError):
    """Raised when a formula uses syntax, functions, or OOXML features outside the supported subset."""


class CircularFormulaError(ValueError):
    """Raised when workbook evaluation encounters a cycle in cell dependencies."""


class FormulaEvaluationError(ValueError):
    """Raised when a formula evaluates to an Excel error token (#DIV/0!, #VALUE!, #REF!, #N/A, #NUM!, etc.)."""


class HeaderFooterLimitError(ValueError):
    """Raised when a worksheet header or footer exceeds Desktop Excel's 255-character limit."""


class CacheParityError(ValueError):
    """Raised when injected or existing <v> cached values diverge from AST-evaluated values."""


class TemplatePreservationError(ValueError):
    """Raised when an output workbook drops or weakens protected features from a customer template."""


_DOUBLE_QUOTED_RE = re.compile(r'"(?:""|[^"])*"')
_SINGLE_QUOTED_RE = re.compile(r"'(?:''|[^'])*'")
_QUOTED_3D_SPAN_RE = re.compile(r"'(?:''|[^'])*:(?:''|[^'])*'\s*!|'(?:''|[^'])+'\s*:\s*'(?:''|[^'])+'\s*!")
_UNQUOTED_3D_SPAN_RE = re.compile(r"[A-Za-z0-9_.]+\s*:\s*[A-Za-z0-9_.]+\s*!")
_COL_ONLY_RANGE_RE = re.compile(r"(?<![A-Za-z0-9_$])\$?[A-Z]{1,3}:\$?[A-Z]{1,3}(?![A-Za-z0-9_$\d])")
_ROW_ONLY_RANGE_RE = re.compile(r"(?<![A-Za-z0-9_$])\$?\d+:\$?\d+(?![A-Za-z0-9_$])")
_SPILL_REF_RE = re.compile(r"\$?[A-Z]{1,3}\$?[1-9]\d*#")
_OOXML_HEX_ESCAPE_RE = re.compile(r"_x([0-9a-fA-F]{4})_")

TOKEN_RE = re.compile(
    r"""
    (?P<STR>"(?:""|[^"])*")
  | (?P<ERR>\#(?:REF!|NAME\?|VALUE!|DIV/0!|N/A|NUM!|NULL!|SPILL!|CALC!|GETTING_DATA))
  | (?P<SHEET_RANGE>(?:'(?:''|[^'])+'|[A-Za-z0-9_.]+)!(\$?[A-Z]{1,3}\$?[1-9]\d*):(\$?[A-Z]{1,3}\$?[1-9]\d*)(?![A-Za-z0-9_.]))
  | (?P<SHEET_CELL>(?:'(?:''|[^'])+'|[A-Za-z0-9_.]+)!(\$?[A-Z]{1,3}\$?[1-9]\d*)(?![A-Za-z0-9_.]))
  | (?P<SHEET_IDENT>(?:'(?:''|[^'])+'|[A-Za-z0-9_.]+)![A-Za-z_][A-Za-z0-9_.]*)
  | (?P<RANGE>\$?[A-Z]{1,3}\$?[1-9]\d*:\$?[A-Z]{1,3}\$?[1-9]\d*(?![A-Za-z0-9_.]))
  | (?P<FUNC>[A-Za-z_][A-Za-z0-9_.]*(?=\s*\())
  | (?P<BOOL>(?:TRUE|FALSE)(?![A-Za-z0-9_.]))
  | (?P<CELL>\$?[A-Z]{1,3}\$?[1-9]\d*(?![A-Za-z0-9_.]))
  | (?P<NUM>(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?)
  | (?P<PCT>%)
  | (?P<OP><=|>=|<>|[=<>+\-*/^,&()])
  | (?P<IDENT>[A-Za-z_][A-Za-z0-9_.]*)
  | (?P<WS>\s+)
    """,
    re.VERBOSE | re.IGNORECASE,
)


@dataclass(frozen=True, slots=True)
class RangeGrid:
    """2D rectangular grid returned by range references inside formulas."""

    values: tuple[tuple[Any, ...], ...]

    @property
    def nrows(self) -> int:
        return len(self.values)

    @property
    def ncols(self) -> int:
        return len(self.values[0]) if self.values else 0

    def flat(self) -> list[Any]:
        return [item for row in self.values for item in row]


# ============================================================================
# AST Node Definitions
# ============================================================================


@dataclass(frozen=True, slots=True)
class NumberNode:
    value: float


@dataclass(frozen=True, slots=True)
class StringNode:
    value: str


@dataclass(frozen=True, slots=True)
class BoolNode:
    value: bool


@dataclass(frozen=True, slots=True)
class ErrorLiteralNode:
    token: str


@dataclass(frozen=True, slots=True)
class CellRefNode:
    sheet: str | None
    row: int
    col: int


@dataclass(frozen=True, slots=True)
class RangeRefNode:
    sheet: str | None
    r1: int
    c1: int
    r2: int
    c2: int


@dataclass(frozen=True, slots=True)
class UnaryOpNode:
    op: str
    operand: AstNode


@dataclass(frozen=True, slots=True)
class PostfixPctNode:
    operand: AstNode


@dataclass(frozen=True, slots=True)
class BinOpNode:
    op: str
    left: AstNode
    right: AstNode


@dataclass(frozen=True, slots=True)
class FuncCallNode:
    name: str
    args: tuple[AstNode, ...]


@dataclass(frozen=True, slots=True)
class IdentNode:
    name: str
    sheet: str | None = None


type AstNode = (
    NumberNode
    | StringNode
    | BoolNode
    | ErrorLiteralNode
    | CellRefNode
    | RangeRefNode
    | UnaryOpNode
    | PostfixPctNode
    | BinOpNode
    | FuncCallNode
    | IdentNode
)


def _clean_sheet_name(raw: str) -> str:
    if raw.startswith("'") and raw.endswith("'"):
        return raw[1:-1].replace("''", "'")
    return raw


def _parse_coord(coord: str) -> tuple[int, int]:
    clean = coord.replace("$", "").upper()
    m = re.match(r"^([A-Z]{1,3})([1-9]\d*)$", clean)
    if not m:
        raise UnsupportedFormulaError(f"Invalid cell coordinate: {coord!r}")
    col_idx = column_index_from_string(m.group(1))
    row_idx = int(m.group(2))
    if col_idx > MAX_EXCEL_COL or row_idx > MAX_EXCEL_ROW:
        raise UnsupportedFormulaError(f"Cell coordinate exceeds Excel bounds: {coord!r}")
    return row_idx, col_idx


def _parse_sheet_cell_spec(spec: str) -> tuple[str, int, int]:
    if "!" not in spec:
        raise ValueError(f"Expected 'Sheet!Cell' coordinate specification, got {spec!r}")
    bang = spec.rfind("!")
    sheet = _clean_sheet_name(spec[:bang].strip())
    row, col = _parse_coord(spec[bang + 1 :].strip())
    return sheet, row, col


def _precheck_unsupported_syntax(expr: str) -> None:
    """Reject external workbooks, structured tables, array braces, 3D spans, and unbounded ranges."""
    masked_strings = _DOUBLE_QUOTED_RE.sub('""', expr)
    if "[" in masked_strings or "]" in masked_strings:
        raise UnsupportedFormulaError(
            f"External workbook or structured table reference is not supported in formula: {expr!r}"
        )
    if "{" in masked_strings or "}" in masked_strings:
        raise UnsupportedFormulaError(f"Array constant or CSE brace syntax is not supported in formula: {expr!r}")
    if _QUOTED_3D_SPAN_RE.search(masked_strings):
        raise UnsupportedFormulaError(f"3D worksheet span reference is not supported in formula: {expr!r}")

    masked_quotes = _SINGLE_QUOTED_RE.sub("'S'", masked_strings)
    if _UNQUOTED_3D_SPAN_RE.search(masked_quotes):
        raise UnsupportedFormulaError(f"3D worksheet span reference is not supported in formula: {expr!r}")
    if _COL_ONLY_RANGE_RE.search(masked_quotes) or _ROW_ONLY_RANGE_RE.search(masked_quotes):
        raise UnsupportedFormulaError(f"Unbounded full-column or full-row range is not supported in formula: {expr!r}")
    if _SPILL_REF_RE.search(masked_quotes):
        raise UnsupportedFormulaError(f"Dynamic spilled array reference (#) is not supported in formula: {expr!r}")


def _tokenize_formula(expr: str) -> list[tuple[str, str]]:
    _precheck_unsupported_syntax(expr)
    pos = 0
    tokens: list[tuple[str, str]] = []
    while pos < len(expr):
        m = TOKEN_RE.match(expr, pos)
        if not m:
            snippet = expr[pos : pos + 32]
            raise UnsupportedFormulaError(f"Unsupported or unrecognized syntax near {snippet!r} in formula: {expr!r}")
        kind = m.lastgroup or ""
        txt = m.group()
        pos = m.end()
        if kind == "WS":
            continue
        if kind == "CELL":
            # Guard >XFD columns: '$' forces an invalid cell ref; bare tokens (e.g. 'XFE1') may be a defined name
            clean = txt.replace("$", "").upper()
            letters_match = re.match(r"^([A-Z]{1,3})([1-9]\d*)$", clean)
            if not letters_match or column_index_from_string(letters_match.group(1)) > MAX_EXCEL_COL:
                if "$" in txt:
                    raise UnsupportedFormulaError(
                        f"Unsupported identifier or out-of-range reference {txt!r} in {expr!r}"
                    )
                kind = "IDENT"
        elif kind == "SHEET_CELL":
            bang = txt.rfind("!")
            coord_part = txt[bang + 1 :]
            clean = coord_part.replace("$", "").upper()
            letters_match = re.match(r"^([A-Z]{1,3})([1-9]\d*)$", clean)
            if not letters_match or column_index_from_string(letters_match.group(1)) > MAX_EXCEL_COL:
                if "$" in coord_part:
                    raise UnsupportedFormulaError(
                        f"Unsupported identifier or out-of-range reference {txt!r} in {expr!r}"
                    )
                kind = "SHEET_IDENT"
        tokens.append((kind, txt))
    return tokens


def parse_formula_ast(expr: str) -> AstNode:
    """Parse an Excel formula body (without leading '=') into a validated AST."""
    if not expr.strip():
        raise UnsupportedFormulaError("Empty formula body after '='")
    tokens = _tokenize_formula(expr)
    idx = 0

    def peek() -> tuple[str, str] | None:
        return tokens[idx] if idx < len(tokens) else None

    def consume(expected_txt: str | None = None) -> tuple[str, str]:
        nonlocal idx
        if idx >= len(tokens):
            raise UnsupportedFormulaError(f"Unexpected end of formula: {expr!r}")
        tok = tokens[idx]
        if expected_txt is not None and tok[1] != expected_txt:
            raise UnsupportedFormulaError(f"Expected {expected_txt!r}, got {tok!r} in formula: {expr!r}")
        idx += 1
        return tok

    def parse_comparison() -> AstNode:
        left = parse_concat()
        while (pk := peek()) and pk[0] == "OP" and pk[1] in ("=", "<>", "<", "<=", ">", ">="):
            op = consume()[1]
            right = parse_concat()
            left = BinOpNode(op, left, right)
        return left

    def parse_concat() -> AstNode:
        left = parse_add()
        while (pk := peek()) and pk[0] == "OP" and pk[1] == "&":
            consume("&")
            right = parse_add()
            left = BinOpNode("&", left, right)
        return left

    def parse_add() -> AstNode:
        left = parse_mul()
        while (pk := peek()) and pk[0] == "OP" and pk[1] in ("+", "-"):
            op = consume()[1]
            right = parse_mul()
            left = BinOpNode(op, left, right)
        return left

    def parse_mul() -> AstNode:
        left = parse_pow()
        while (pk := peek()) and pk[0] == "OP" and pk[1] in ("*", "/"):
            op = consume()[1]
            right = parse_pow()
            left = BinOpNode(op, left, right)
        return left

    def parse_pow() -> AstNode:
        left = parse_unary()
        while (pk := peek()) and pk[0] == "OP" and pk[1] == "^":
            consume("^")
            right = parse_unary()
            left = BinOpNode("^", left, right)
        return left

    def parse_unary() -> AstNode:
        pk = peek()
        if pk and pk[0] == "OP" and pk[1] in ("+", "-"):
            op = consume()[1]
            return UnaryOpNode(op, parse_unary())
        node = parse_primary()
        while (pk2 := peek()) and pk2[0] == "PCT":
            consume()
            node = PostfixPctNode(node)
        return node

    def parse_primary() -> AstNode:
        pk = peek()
        if pk is None:
            raise UnsupportedFormulaError(f"Incomplete expression in formula: {expr!r}")
        kind, txt = pk
        if kind == "OP" and txt == "(":
            consume("(")
            inner = parse_comparison()
            consume(")")
            return inner
        if kind == "NUM":
            consume()
            return NumberNode(float(txt))
        if kind == "STR":
            consume()
            return StringNode(txt[1:-1].replace('""', '"'))
        if kind == "BOOL":
            consume()
            return BoolNode(txt.upper() == "TRUE")
        if kind == "ERR":
            consume()
            return ErrorLiteralNode(txt.upper())
        if kind == "SHEET_RANGE":
            consume()
            bang = txt.rfind("!")
            sh = _clean_sheet_name(txt[:bang])
            c1_str, c2_str = txt[bang + 1 :].split(":")
            r1, c1 = _parse_coord(c1_str)
            r2, c2 = _parse_coord(c2_str)
            return RangeRefNode(sh, r1, c1, r2, c2)
        if kind == "RANGE":
            consume()
            c1_str, c2_str = txt.split(":")
            r1, c1 = _parse_coord(c1_str)
            r2, c2 = _parse_coord(c2_str)
            return RangeRefNode(None, r1, c1, r2, c2)
        if kind == "SHEET_CELL":
            consume()
            bang = txt.rfind("!")
            sh = _clean_sheet_name(txt[:bang])
            r, c = _parse_coord(txt[bang + 1 :])
            return CellRefNode(sh, r, c)
        if kind == "CELL":
            consume()
            r, c = _parse_coord(txt)
            return CellRefNode(None, r, c)
        if kind == "FUNC":
            raw_fn = consume()[1].upper()
            # Normalize modern _xlfn. prefix if openpyxl preserved it on supported functions like IFS
            fn_name = raw_fn.removeprefix("_XLFN.")
            if fn_name not in SUPPORTED_FUNCTIONS:
                raise UnsupportedFormulaError(f"Unsupported Excel function {raw_fn!r} in formula: {expr!r}")
            consume("(")
            args: list[AstNode] = []
            if (nxt := peek()) and not (nxt[0] == "OP" and nxt[1] == ")"):
                while True:
                    if (cur := peek()) and cur[0] == "OP" and cur[1] in (",", ")"):
                        # Omitted positional argument such as IF(A1,,0) -> treated as 0/empty
                        args.append(NumberNode(0.0))
                    else:
                        args.append(parse_comparison())
                    if (sep := peek()) and sep[0] == "OP" and sep[1] == ",":
                        consume(",")
                    else:
                        break
            consume(")")
            return FuncCallNode(fn_name, tuple(args))
        if kind == "SHEET_IDENT":
            consume()
            bang = txt.rfind("!")
            sh = _clean_sheet_name(txt[:bang])
            return IdentNode(name=txt[bang + 1 :], sheet=sh)
        if kind == "IDENT":
            consume()
            return IdentNode(name=txt, sheet=None)
        raise UnsupportedFormulaError(f"Unexpected token {pk!r} in formula: {expr!r}")

    root = parse_comparison()
    if idx != len(tokens):
        raise UnsupportedFormulaError(f"Unexpected trailing tokens {tokens[idx:]!r} in formula: {expr!r}")
    return root


def _excel_Criteria_wildcard_to_glob(pattern: str) -> tuple[str, bool]:
    """Convert Excel wildcard string (*, ?, ~*, ~?, ~~) to fnmatch pattern and report if wildcards exist."""
    out: list[str] = []
    has_wildcard = False
    i = 0
    while i < len(pattern):
        ch = pattern[i]
        if ch == "~" and i + 1 < len(pattern) and pattern[i + 1] in ("*", "?", "~"):
            nxt = pattern[i + 1]
            out.append(f"[{nxt}]" if nxt in ("*", "?") else "~")
            i += 2
            continue
        if ch in ("*", "?"):
            has_wildcard = True
            out.append(ch)
        elif ch == "[":
            out.append("[[]")
        else:
            out.append(ch)
        i += 1
    return "".join(out), has_wildcard


def _format_excel_text(val: float, fmt: str) -> str:
    """Format a numeric value using supported Excel TEXT masks (#,##0, #,##0.00, 0.0%, currency prefixes)."""
    sections = fmt.split(";")
    if len(sections) > 3 or not sections[0]:
        raise UnsupportedFormulaError(f"Unsupported TEXT format mask: {fmt!r}")

    d_val = Decimal(str(val))
    if d_val < 0 and len(sections) >= 2:
        active_fmt = sections[1]
        use_abs = True
    elif d_val == 0 and len(sections) == 3:
        active_fmt = sections[2]
        use_abs = True
    else:
        active_fmt = sections[0]
        use_abs = False

    # Strip quoted literals inside format mask while capturing simple prefix/suffix
    clean_fmt = active_fmt.replace('"', "")
    if any(tok in clean_fmt.lower() for tok in ("yy", "mm", "dd", "hh", "ss", "am/pm", "e+", "e-", "?")):
        raise UnsupportedFormulaError(f"Unsupported date/scientific/fraction TEXT format mask: {fmt!r}")

    m = re.match(r"^([^0#.,%]*?)([0#.,]+)(%?[^0#.,%]*)$", clean_fmt)
    if not m:
        raise UnsupportedFormulaError(f"Unsupported TEXT format mask: {fmt!r}")

    prefix, num_pat, suffix = m.group(1), m.group(2), m.group(3)
    is_pct = "%" in suffix or "%" in prefix
    work_val = abs(d_val) if use_abs else d_val
    if is_pct:
        work_val = work_val * Decimal(100)

    use_grouping = "," in num_pat
    plain_pat = num_pat.replace(",", "")
    if plain_pat.count(".") > 1:
        raise UnsupportedFormulaError(f"Invalid decimal specifiers in TEXT format mask: {fmt!r}")

    if "." in plain_pat:
        int_pat, frac_pat = plain_pat.split(".")
        decimals = len(frac_pat)
    else:
        int_pat, frac_pat = plain_pat, ""
        decimals = 0

    quant = Decimal(10) ** (-decimals) if decimals > 0 else Decimal(1)
    rounded = work_val.quantize(quant, rounding=ROUND_HALF_UP)
    is_neg = rounded < 0 and not use_abs
    abs_rounded = abs(rounded)

    sign_str = "-" if is_neg else ""
    if decimals > 0:
        formatted_num = f"{abs_rounded:,.{decimals}f}" if use_grouping else f"{abs_rounded:.{decimals}f}"
        # Trim optional '#' trailing fractional digits if present
        if "#" in frac_pat:
            min_dec = frac_pat.count("0")
            int_part, dec_part = formatted_num.split(".")
            while len(dec_part) > min_dec and dec_part.endswith("0"):
                dec_part = dec_part[:-1]
            formatted_num = f"{int_part}.{dec_part}" if dec_part else int_part
    else:
        int_val = int(abs_rounded)
        if int_val == 0 and "0" not in int_pat:
            formatted_num = ""
        else:
            formatted_num = f"{int_val:,}" if use_grouping else f"{int_val}"

    return f"{sign_str}{prefix}{formatted_num}{suffix}"


class WorkbookEvaluator:
    """Deterministic, fail-closed AST evaluator for Excel formulas on an ``openpyxl.Workbook``."""

    def __init__(
        self,
        wb: openpyxl.Workbook,
        *,
        formula_coords_by_sheet: Mapping[str, Sequence[tuple[int, int]]] | None = None,
        max_range_cells: int = MAX_RANGE_EVAL_CELLS,
        max_total_range_cells: int = MAX_TOTAL_RANGE_EVAL_CELLS,
    ) -> None:
        self.wb = wb
        self.cache: dict[tuple[str, int, int], Any] = {}
        self.visiting: set[tuple[str, int, int]] = set()
        self._ast_cache: dict[str, AstNode] = {}
        self._formula_coords_by_sheet = formula_coords_by_sheet
        self.max_range_cells = max_range_cells
        self.max_total_range_cells = max_total_range_cells
        self._expanded_range_cells = 0

    def eval_coord(self, sheet: str, coord: str) -> Any:
        """Evaluate a cell by worksheet name and Excel coordinate such as ``'B12'``."""
        row, col = _parse_coord(coord)
        return self.eval_cell(sheet, row, col)

    def eval_formula(self, formula: str, current_sheet: str) -> Any:
        """Evaluate an ad-hoc Excel formula (with or without leading ``=``) in ``current_sheet`` context."""
        body = formula[1:].strip() if formula.startswith("=") else formula.strip()
        val = self._eval_formula_body(body, current_sheet)
        if isinstance(val, RangeGrid):
            if val.nrows == 1 and val.ncols == 1:
                val = val.values[0][0]
            else:
                raise UnsupportedFormulaError(f"Spilled multi-cell range result is not supported: {formula!r}")
        return 0.0 if val is None else val

    def eval_cell(self, sheet: str, row: int, col: int) -> Any:
        """Evaluate ``sheet!(row, col)``, detecting cycles and propagating formula errors."""
        if sheet not in self.wb.sheetnames:
            raise FormulaEvaluationError(f"#REF! Worksheet {sheet!r} does not exist")
        key = (sheet, row, col)
        if key in self.cache:
            return self.cache[key]
        if key in self.visiting:
            coord = f"{get_column_letter(col)}{row}"
            raise CircularFormulaError(f"Circular formula reference detected at {sheet}!{coord}")

        ws = self.wb[sheet]
        cells_map = getattr(ws, "_cells", None)
        if isinstance(cells_map, dict):
            cell_obj = cells_map.get((row, col))
            raw_val = cell_obj.value if cell_obj is not None else None
        else:
            raw_val = ws.cell(row, col).value

        if isinstance(raw_val, (ArrayFormula, DataTableFormula)):
            coord = f"{get_column_letter(col)}{row}"
            raise UnsupportedFormulaError(f"Array or data-table formula object at {sheet}!{coord} is not supported")
        if isinstance(raw_val, Decimal):
            num_val = float(raw_val)
            self.cache[key] = num_val
            return num_val
        if isinstance(raw_val, str):
            if raw_val.upper() in EXCEL_ERROR_TOKENS:
                coord = f"{get_column_letter(col)}{row}"
                raise FormulaEvaluationError(f"Cell {sheet}!{coord} contains Excel error literal {raw_val}")
            if raw_val.startswith("="):
                self.visiting.add(key)
                try:
                    res = self._eval_formula_body(raw_val[1:].strip(), sheet)
                finally:
                    self.visiting.discard(key)
                if isinstance(res, RangeGrid):
                    if res.nrows == 1 and res.ncols == 1:
                        res = res.values[0][0]
                    else:
                        coord = f"{get_column_letter(col)}{row}"
                        raise UnsupportedFormulaError(
                            f"Spilled range formula at {sheet}!{coord} is not supported: {raw_val!r}"
                        )
                # In Excel, a formula directly returning an empty cell reference (=B1) evaluates to numeric 0
                final_res: Any = 0.0 if res is None else res
                if isinstance(final_res, str) and final_res.upper() in EXCEL_ERROR_TOKENS:
                    coord = f"{get_column_letter(col)}{row}"
                    raise FormulaEvaluationError(
                        f"Formula at {sheet}!{coord} evaluated to Excel error token {final_res}"
                    )
                if (
                    isinstance(final_res, (int, float))
                    and not isinstance(final_res, bool)
                    and (math.isnan(float(final_res)) or math.isinf(float(final_res)))
                ):
                    coord = f"{get_column_letter(col)}{row}"
                    raise FormulaEvaluationError(f"#NUM! Non-finite result at {sheet}!{coord}")
                self.cache[key] = final_res
                return final_res

        self.cache[key] = raw_val
        return raw_val

    def eval_range_grid(self, sheet: str, r1: int, c1: int, r2: int, c2: int) -> RangeGrid:
        """Evaluate a 2D cell range into a shape-preserving ``RangeGrid`` within cell-expansion bounds."""
        if sheet not in self.wb.sheetnames:
            raise FormulaEvaluationError(f"#REF! Worksheet {sheet!r} does not exist")
        row_start, row_end = min(r1, r2), max(r1, r2)
        col_start, col_end = min(c1, c2), max(c1, c2)
        span_cells = (row_end - row_start + 1) * (col_end - col_start + 1)
        if span_cells > self.max_range_cells:
            raise FormulaEvaluationError(
                f"Range {sheet}!{get_column_letter(col_start)}{row_start}:{get_column_letter(col_end)}{row_end} "
                f"expands to {span_cells} cells, exceeding safety budget {self.max_range_cells}"
            )
        self._expanded_range_cells += span_cells
        if self._expanded_range_cells > self.max_total_range_cells:
            raise FormulaEvaluationError(
                f"Cumulative evaluated range cells ({self._expanded_range_cells}) "
                f"exceed safety budget {self.max_total_range_cells}"
            )
        rows: list[tuple[Any, ...]] = []
        for r in range(row_start, row_end + 1):
            row_vals = tuple(self.eval_cell(sheet, r, c) for c in range(col_start, col_end + 1))
            rows.append(row_vals)
        return RangeGrid(tuple(rows))

    def _eval_formula_body(self, expr: str, current_sheet: str) -> Any:
        ast_root = self._ast_cache.get(expr)
        if ast_root is None:
            ast_root = parse_formula_ast(expr)
            self._ast_cache[expr] = ast_root
        return self._eval_node(ast_root, current_sheet, expr)

    def _unwrap_scalar(self, val: Any, expr: str) -> Any:
        if isinstance(val, RangeGrid):
            if val.nrows == 1 and val.ncols == 1:
                return val.values[0][0]
            raise FormulaEvaluationError(
                f"#VALUE! Expected scalar value, got {val.nrows}x{val.ncols} range in {expr!r}"
            )
        return val

    def _to_num(self, val: Any, expr: str) -> float:
        val = self._unwrap_scalar(val, expr)
        if val is None:
            return 0.0
        if isinstance(val, bool):
            return 1.0 if val else 0.0
        if isinstance(val, (int, float, Decimal)):
            fval = float(val)
            if math.isnan(fval) or math.isinf(fval):
                raise FormulaEvaluationError(f"#NUM! Non-finite numeric operand in {expr!r}")
            return fval
        if isinstance(val, str):
            stripped = val.strip()
            if stripped:
                try:
                    fval = float(stripped)
                    if not (math.isnan(fval) or math.isinf(fval)):
                        return fval
                except ValueError:
                    pass
        raise FormulaEvaluationError(f"#VALUE! Non-numeric operand {val!r} in {expr!r}")

    def _to_bool(self, val: Any, expr: str) -> bool:
        val = self._unwrap_scalar(val, expr)
        if val is None:
            return False
        if isinstance(val, bool):
            return val
        if isinstance(val, (int, float, Decimal)):
            return float(val) != 0.0
        if isinstance(val, str):
            up = val.strip().upper()
            if up == "TRUE":
                return True
            if up == "FALSE":
                return False
        raise FormulaEvaluationError(f"#VALUE! Cannot convert {val!r} to logical boolean in {expr!r}")

    def _to_excel_str(self, val: Any, expr: str) -> str:
        val = self._unwrap_scalar(val, expr)
        if val is None:
            return ""
        if isinstance(val, bool):
            return "TRUE" if val else "FALSE"
        if isinstance(val, int):
            return str(val)
        if isinstance(val, (float, Decimal)):
            fval = float(val)
            if fval.is_integer() and abs(fval) < 1e15:
                return str(int(fval))
            return _format_numeric_cache(fval)
        return str(val)

    @staticmethod
    def _type_rank(val: Any) -> tuple[int, Any]:
        if val is None:
            return (0, 0.0)
        if isinstance(val, bool):
            return (2, 1 if val else 0)
        if isinstance(val, (int, float, Decimal)):
            return (0, float(val))
        return (1, str(val).lower())

    @classmethod
    def _compare(cls, left: Any, op: str, right: Any) -> bool:
        if op in ("=", "<>"):
            if (
                left is None
                and right in (None, 0, 0.0, "", False)
                or right is None
                and left in (None, 0, 0.0, "", False)
            ):
                is_eq = True
            else:
                is_eq = cls._type_rank(left) == cls._type_rank(right)
            return is_eq if op == "=" else not is_eq

        rl = cls._type_rank(left)
        rr = cls._type_rank(right)
        if op == "<":
            return rl < rr
        if op == "<=":
            return rl <= rr
        if op == ">":
            return rl > rr
        if op == ">=":
            return rl >= rr
        raise UnsupportedFormulaError(f"Unsupported comparison operator {op!r}")

    def _matches_criteria(self, item: Any, crit: Any) -> bool:
        if isinstance(crit, str):
            for prefix in ("<=", ">=", "<>", "<", ">", "="):
                if crit.startswith(prefix):
                    rhs_txt = crit[len(prefix) :].strip()
                    if rhs_txt == "":
                        is_blank = item is None or item == ""
                        if prefix == "=":
                            return is_blank
                        if prefix == "<>":
                            return not is_blank
                    rhs_val: Any
                    if rhs_txt.upper() in ("TRUE", "FALSE"):
                        rhs_val = rhs_txt.upper() == "TRUE"
                    else:
                        try:
                            rhs_val = float(rhs_txt)
                        except ValueError:
                            rhs_val = rhs_txt
                    if prefix in ("<", "<=", ">", ">=") and isinstance(rhs_val, float):
                        if not (isinstance(item, (int, float, Decimal)) and not isinstance(item, bool)):
                            return False
                        return self._compare(float(item), prefix, rhs_val)
                    return self._compare(item, prefix, rhs_val)

            # Plain string criteria: check numeric equality if criteria looks like a number, else wildcard/casefold
            try:
                crit_num = float(crit.strip())
                if isinstance(item, (int, float, Decimal)) and not isinstance(item, bool):
                    return float(item) == crit_num
            except ValueError:
                pass

            glob_pat, has_wild = _excel_Criteria_wildcard_to_glob(crit.lower())
            item_str = "" if item is None else str(item).lower()
            if has_wild:
                if item is None:
                    return False
                return fnmatch.fnmatchcase(item_str, glob_pat)
            return item_str == glob_pat

        if crit is None:
            return item is None or item == ""
        if isinstance(crit, bool):
            return isinstance(item, bool) and item == crit
        if isinstance(crit, (int, float, Decimal)):
            return isinstance(item, (int, float, Decimal)) and not isinstance(item, bool) and float(item) == float(crit)
        return item == crit

    def _resolve_defined_name_ast(
        self,
        ident: IdentNode,
        current_sheet: str,
        expr: str,
    ) -> tuple[AstNode, str]:
        """Resolve a workbook- or sheet-scoped defined name to a validated AST node and scope sheet."""
        target_name_low = ident.name.lower()
        lookup_sheet = ident.sheet if ident.sheet is not None else current_sheet
        if ident.sheet is not None and ident.sheet not in self.wb.sheetnames:
            raise UnsupportedFormulaError(
                f"Worksheet {ident.sheet!r} for defined name {ident.name!r} does not exist in formula: {expr!r}"
            )

        matched_dn: Any = None
        scope_sheet = lookup_sheet

        # 1. Sheet-scoped defined_names on the target/current worksheet (shadows workbook-global names)
        if lookup_sheet in self.wb.sheetnames:
            ws = self.wb[lookup_sheet]
            ws_dn_dict = getattr(ws, "defined_names", None)
            if ws_dn_dict is not None:
                for dn in ws_dn_dict.values():
                    if getattr(dn, "name", "").lower() == target_name_low:
                        matched_dn = dn
                        break

        # 2. Workbook defined_names with explicit localSheetId matching lookup_sheet
        wb_dn_dict = getattr(self.wb, "defined_names", None)
        if matched_dn is None and wb_dn_dict is not None and lookup_sheet in self.wb.sheetnames:
            sheet_idx = self.wb.sheetnames.index(lookup_sheet)
            for dn in wb_dn_dict.values():
                if (
                    getattr(dn, "localSheetId", None) == sheet_idx
                    and getattr(dn, "name", "").lower() == target_name_low
                ):
                    matched_dn = dn
                    break

        # 3. Workbook-global defined_names (only when no explicit sheet qualifier was requested)
        if matched_dn is None and ident.sheet is None and wb_dn_dict is not None:
            for dn in wb_dn_dict.values():
                if getattr(dn, "localSheetId", None) is None and getattr(dn, "name", "").lower() == target_name_low:
                    matched_dn = dn
                    scope_sheet = current_sheet
                    break

        if matched_dn is None:
            raise UnsupportedFormulaError(f"Defined name or unsupported identifier {ident.name!r} in formula: {expr!r}")

        raw_attr = (getattr(matched_dn, "attr_text", None) or "").strip()
        dn_body = raw_attr[1:].strip() if raw_attr.startswith("=") else raw_attr
        if not dn_body:
            raise UnsupportedFormulaError(f"Defined name {ident.name!r} has empty definition in formula: {expr!r}")

        dn_ast = self._ast_cache.get(dn_body)
        if dn_ast is None:
            try:
                dn_ast = parse_formula_ast(dn_body)
            except UnsupportedFormulaError as exc:
                raise UnsupportedFormulaError(
                    f"Defined name {ident.name!r} uses unsupported syntax {raw_attr!r}: {exc}"
                ) from exc
            self._ast_cache[dn_body] = dn_ast

        if isinstance(dn_ast, (CellRefNode, RangeRefNode, NumberNode, StringNode)):
            return dn_ast, scope_sheet
        if isinstance(dn_ast, UnaryOpNode) and dn_ast.op in ("+", "-") and isinstance(dn_ast.operand, NumberNode):
            return dn_ast, scope_sheet
        if isinstance(dn_ast, PostfixPctNode) and isinstance(dn_ast.operand, NumberNode):
            return dn_ast, scope_sheet

        raise UnsupportedFormulaError(
            f"Defined name {ident.name!r} definition {raw_attr!r} is outside supported cell/range/constant syntax"
        )

    def _is_cell_reference_arg(self, node: AstNode, current_sheet: str, expr: str) -> bool:
        if isinstance(node, CellRefNode):
            return True
        if isinstance(node, IdentNode):
            dn_ast, _ = self._resolve_defined_name_ast(node, current_sheet, expr)
            return isinstance(dn_ast, CellRefNode)
        return False

    @staticmethod
    def _decimal_round(val: float, digits: int, mode: str) -> float:
        try:
            d_val = Decimal(str(val))
            quant = Decimal(10) ** (-digits)
            res = d_val.quantize(quant, rounding=mode)
            return float(res)
        except (InvalidOperation, OverflowError) as exc:
            raise FormulaEvaluationError(f"#NUM! Decimal rounding error on {val!r} (digits={digits})") from exc

    def _eval_node(self, node: AstNode, current_sheet: str, expr: str) -> Any:
        if isinstance(node, NumberNode):
            return node.value
        if isinstance(node, StringNode):
            return node.value
        if isinstance(node, BoolNode):
            return node.value
        if isinstance(node, ErrorLiteralNode):
            raise FormulaEvaluationError(f"Excel error literal {node.token} in {expr!r}")
        if isinstance(node, CellRefNode):
            target_sheet = node.sheet or current_sheet
            return self.eval_cell(target_sheet, node.row, node.col)
        if isinstance(node, RangeRefNode):
            target_sheet = node.sheet or current_sheet
            return self.eval_range_grid(target_sheet, node.r1, node.c1, node.r2, node.c2)
        if isinstance(node, UnaryOpNode):
            val = self._to_num(self._eval_node(node.operand, current_sheet, expr), expr)
            return -val if node.op == "-" else val
        if isinstance(node, PostfixPctNode):
            val = self._to_num(self._eval_node(node.operand, current_sheet, expr), expr)
            return val / 100.0
        if isinstance(node, BinOpNode):
            left = self._unwrap_scalar(self._eval_node(node.left, current_sheet, expr), expr)
            right = self._unwrap_scalar(self._eval_node(node.right, current_sheet, expr), expr)
            op = node.op
            if op in ("=", "<>", "<", "<=", ">", ">="):
                return self._compare(left, op, right)
            if op == "&":
                return self._to_excel_str(left, expr) + self._to_excel_str(right, expr)
            n1 = self._to_num(left, expr)
            n2 = self._to_num(right, expr)
            if op == "+":
                return n1 + n2
            if op == "-":
                return n1 - n2
            if op == "*":
                return n1 * n2
            if op == "/":
                if n2 == 0.0:
                    raise FormulaEvaluationError(f"#DIV/0! Division by zero in {expr!r}")
                return n1 / n2
            if op == "^":
                if n1 == 0.0 and n2 < 0.0:
                    raise FormulaEvaluationError(f"#DIV/0! Zero raised to negative power in {expr!r}")
                if n1 < 0.0 and not float(n2).is_integer():
                    raise FormulaEvaluationError(f"#NUM! Negative base with fractional exponent in {expr!r}")
                try:
                    res = float(n1**n2)
                except OverflowError as exc:
                    raise FormulaEvaluationError(f"#NUM! Exponentiation overflow in {expr!r}") from exc
                return res
            raise UnsupportedFormulaError(f"Unsupported binary operator {op!r}")
        if isinstance(node, FuncCallNode):
            return self._eval_func(node.name, node.args, current_sheet, expr)
        if isinstance(node, IdentNode):
            dn_ast, dn_scope_sheet = self._resolve_defined_name_ast(node, current_sheet, expr)
            return self._eval_node(dn_ast, dn_scope_sheet, expr)
        raise UnsupportedFormulaError(f"Unknown AST node {type(node).__name__}")

    def _require_arity(self, fn: str, args: Sequence[Any], min_args: int, max_args: int | None = None) -> None:
        if len(args) < min_args or (max_args is not None and len(args) > max_args):
            bound = f"{min_args}" if max_args == min_args else f"{min_args}..{max_args or 'inf'}"
            raise FormulaEvaluationError(f"#VALUE! {fn} expected {bound} argument(s), got {len(args)}")

    @staticmethod
    def _extract_numeric_list(evaled_args: Sequence[Any], *, coerce_scalars: bool, expr: str) -> list[float]:
        nums: list[float] = []
        for arg in evaled_args:
            if isinstance(arg, RangeGrid):
                for item in arg.flat():
                    if isinstance(item, (int, float, Decimal)) and not isinstance(item, bool):
                        nums.append(float(item))
            elif arg is None:
                continue
            elif isinstance(arg, bool):
                if coerce_scalars:
                    nums.append(1.0 if arg else 0.0)
            elif isinstance(arg, (int, float, Decimal)):
                nums.append(float(arg))
            elif coerce_scalars and isinstance(arg, str):
                try:
                    nums.append(float(arg.strip()))
                except ValueError as exc:
                    raise FormulaEvaluationError(f"#VALUE! Non-numeric scalar {arg!r} in {expr!r}") from exc
        return nums

    def _eval_func(self, fn: str, arg_nodes: tuple[AstNode, ...], current_sheet: str, expr: str) -> Any:
        # Lazy-evaluated control-flow functions
        if fn == "IF":
            self._require_arity(fn, arg_nodes, 2, 3)
            cond = self._to_bool(self._eval_node(arg_nodes[0], current_sheet, expr), expr)
            if cond:
                return self._eval_node(arg_nodes[1], current_sheet, expr)
            if len(arg_nodes) == 3:
                return self._eval_node(arg_nodes[2], current_sheet, expr)
            return False

        if fn == "IFS":
            if len(arg_nodes) < 2 or len(arg_nodes) % 2 != 0:
                raise FormulaEvaluationError(f"#VALUE! IFS requires pairs of (condition, value) in {expr!r}")
            for i in range(0, len(arg_nodes), 2):
                if self._to_bool(self._eval_node(arg_nodes[i], current_sheet, expr), expr):
                    return self._eval_node(arg_nodes[i + 1], current_sheet, expr)
            raise FormulaEvaluationError(f"#N/A No TRUE condition matched in IFS({expr!r})")

        if fn == "IFERROR":
            self._require_arity(fn, arg_nodes, 2, 2)
            try:
                val = self._eval_node(arg_nodes[0], current_sheet, expr)
                if isinstance(val, str) and val.upper() in EXCEL_ERROR_TOKENS:
                    raise FormulaEvaluationError(val)
                return val
            except FormulaEvaluationError:
                return self._eval_node(arg_nodes[1], current_sheet, expr)

        if fn == "CHOOSE":
            self._require_arity(fn, arg_nodes, 2)
            idx_num = math.trunc(self._to_num(self._eval_node(arg_nodes[0], current_sheet, expr), expr))
            choices = arg_nodes[1:]
            if idx_num < 1 or idx_num > len(choices):
                raise FormulaEvaluationError(f"#VALUE! CHOOSE index {idx_num} out of range 1..{len(choices)}")
            return self._eval_node(choices[idx_num - 1], current_sheet, expr)

        # Eagerly evaluate arguments for strict functions
        args = [self._eval_node(a, current_sheet, expr) for a in arg_nodes]

        if fn == "SUM":
            self._require_arity(fn, args, 1)
            # Cell references to text/blank are ignored; direct scalar literals were AST Number/String/Bool nodes
            total = 0.0
            for a_node, val in zip(arg_nodes, args, strict=True):
                if isinstance(val, RangeGrid):
                    for item in val.flat():
                        if isinstance(item, (int, float, Decimal)) and not isinstance(item, bool):
                            total += float(item)
                elif self._is_cell_reference_arg(a_node, current_sheet, expr):
                    if isinstance(val, (int, float, Decimal)) and not isinstance(val, bool):
                        total += float(val)
                else:
                    total += self._to_num(val, expr)
            return total

        if fn == "AVERAGE":
            self._require_arity(fn, args, 1)
            nums: list[float] = []
            for a_node, val in zip(arg_nodes, args, strict=True):
                if isinstance(val, RangeGrid):
                    nums.extend(
                        float(x) for x in val.flat() if isinstance(x, (int, float, Decimal)) and not isinstance(x, bool)
                    )
                elif self._is_cell_reference_arg(a_node, current_sheet, expr):
                    if isinstance(val, (int, float, Decimal)) and not isinstance(val, bool):
                        nums.append(float(val))
                else:
                    nums.append(self._to_num(val, expr))
            if not nums:
                raise FormulaEvaluationError(f"#DIV/0! AVERAGE over zero numeric values in {expr!r}")
            return sum(nums) / len(nums)

        if fn == "MIN":
            self._require_arity(fn, args, 1)
            nums = self._extract_numeric_list(args, coerce_scalars=False, expr=expr)
            return min(nums) if nums else 0.0

        if fn == "MAX":
            self._require_arity(fn, args, 1)
            nums = self._extract_numeric_list(args, coerce_scalars=False, expr=expr)
            return max(nums) if nums else 0.0

        if fn == "COUNT":
            self._require_arity(fn, args, 1)
            return len(self._extract_numeric_list(args, coerce_scalars=False, expr=expr))

        if fn == "COUNTA":
            self._require_arity(fn, args, 1)
            count = 0
            for val in args:
                items = val.flat() if isinstance(val, RangeGrid) else [val]
                count += sum(1 for item in items if item is not None)
            return count

        if fn == "COUNTIF":
            self._require_arity(fn, args, 2, 2)
            items = args[0].flat() if isinstance(args[0], RangeGrid) else [args[0]]
            crit = self._unwrap_scalar(args[1], expr)
            return sum(1 for item in items if self._matches_criteria(item, crit))

        if fn == "SUMIF":
            self._require_arity(fn, args, 2, 3)
            crit_items = args[0].flat() if isinstance(args[0], RangeGrid) else [args[0]]
            crit = self._unwrap_scalar(args[1], expr)
            sum_items = (
                (args[2].flat() if isinstance(args[2], RangeGrid) else [args[2]]) if len(args) == 3 else crit_items
            )
            if len(sum_items) != len(crit_items):
                raise FormulaEvaluationError(
                    f"#VALUE! SUMIF range length {len(crit_items)} != sum_range length {len(sum_items)}"
                )
            total = 0.0
            for c_val, s_val in zip(crit_items, sum_items, strict=True):
                if (
                    self._matches_criteria(c_val, crit)
                    and isinstance(s_val, (int, float, Decimal))
                    and not isinstance(s_val, bool)
                ):
                    total += float(s_val)
            return total

        if fn == "SUMIFS":
            if len(args) < 3 or len(args) % 2 == 0:
                raise FormulaEvaluationError("#VALUE! SUMIFS requires sum_range plus (criteria_range, criteria) pairs")
            sum_grid = args[0] if isinstance(args[0], RangeGrid) else RangeGrid(((args[0],),))
            sum_flat = sum_grid.flat()
            pairs: list[tuple[list[Any], Any]] = []
            for i in range(1, len(args), 2):
                c_grid = args[i] if isinstance(args[i], RangeGrid) else RangeGrid(((args[i],),))
                if (c_grid.nrows, c_grid.ncols) != (sum_grid.nrows, sum_grid.ncols):
                    raise FormulaEvaluationError(
                        f"#VALUE! SUMIFS criteria_range {(c_grid.nrows, c_grid.ncols)} "
                        f"mismatches sum_range {(sum_grid.nrows, sum_grid.ncols)}"
                    )
                pairs.append((c_grid.flat(), self._unwrap_scalar(args[i + 1], expr)))

            total = 0.0
            for idx_cell, s_val in enumerate(sum_flat):
                if not (isinstance(s_val, (int, float, Decimal)) and not isinstance(s_val, bool)):
                    continue
                if all(self._matches_criteria(c_flat[idx_cell], crit) for c_flat, crit in pairs):
                    total += float(s_val)
            return total

        if fn == "SUMPRODUCT":
            self._require_arity(fn, args, 1)
            grids = [a if isinstance(a, RangeGrid) else RangeGrid(((a,),)) for a in args]
            shape = (grids[0].nrows, grids[0].ncols)
            for g in grids[1:]:
                if (g.nrows, g.ncols) != shape:
                    raise FormulaEvaluationError(
                        f"#VALUE! SUMPRODUCT array dimension mismatch: {(g.nrows, g.ncols)} != {shape}"
                    )
            flats = [g.flat() for g in grids]
            total = 0.0
            for row_tuple in zip(*flats, strict=True):
                prod = 1.0
                for v in row_tuple:
                    if isinstance(v, (int, float, Decimal)) and not isinstance(v, bool):
                        prod *= float(v)
                    else:
                        prod = 0.0
                        break
                total += prod
            return total

        if fn in ("AND", "OR"):
            self._require_arity(fn, args, 1)
            bools: list[bool] = []
            for a_node, val in zip(arg_nodes, args, strict=True):
                if isinstance(val, RangeGrid):
                    for item in val.flat():
                        if isinstance(item, bool):
                            bools.append(item)
                        elif isinstance(item, (int, float, Decimal)):
                            bools.append(float(item) != 0.0)
                elif self._is_cell_reference_arg(a_node, current_sheet, expr) and (val is None or isinstance(val, str)):
                    if isinstance(val, str) and val.strip().upper() in ("TRUE", "FALSE"):
                        bools.append(val.strip().upper() == "TRUE")
                else:
                    bools.append(self._to_bool(val, expr))
            if not bools:
                raise FormulaEvaluationError(f"#VALUE! {fn} found no logical operands in {expr!r}")
            return all(bools) if fn == "AND" else any(bools)

        if fn == "NOT":
            self._require_arity(fn, args, 1, 1)
            return not self._to_bool(args[0], expr)

        if fn == "ROUND":
            self._require_arity(fn, args, 2, 2)
            val = self._to_num(args[0], expr)
            digits = math.trunc(self._to_num(args[1], expr))
            return self._decimal_round(val, digits, ROUND_HALF_UP)

        if fn == "ROUNDUP":
            self._require_arity(fn, args, 2, 2)
            val = self._to_num(args[0], expr)
            digits = math.trunc(self._to_num(args[1], expr))
            return self._decimal_round(val, digits, ROUND_UP)

        if fn == "ROUNDDOWN":
            self._require_arity(fn, args, 2, 2)
            val = self._to_num(args[0], expr)
            digits = math.trunc(self._to_num(args[1], expr))
            return self._decimal_round(val, digits, ROUND_DOWN)

        if fn == "INT":
            self._require_arity(fn, args, 1, 1)
            return float(math.floor(self._to_num(args[0], expr)))

        if fn == "ABS":
            self._require_arity(fn, args, 1, 1)
            return abs(self._to_num(args[0], expr))

        if fn == "CEILING":
            self._require_arity(fn, args, 2, 2)
            num = self._to_num(args[0], expr)
            sig = self._to_num(args[1], expr)
            if num == 0.0 or sig == 0.0:
                return 0.0
            if num > 0.0 and sig < 0.0:
                raise FormulaEvaluationError(f"#NUM! CEILING positive number {num} with negative significance {sig}")
            d_num = Decimal(str(num))
            d_sig = Decimal(str(sig))
            if d_num > 0 and d_sig > 0:
                q = (d_num / d_sig).to_integral_value(rounding=ROUND_CEILING)
                return float(q * d_sig)
            if d_num < 0 and d_sig < 0:
                q = (abs(d_num) / abs(d_sig)).to_integral_value(rounding=ROUND_CEILING)
                return float(q * d_sig)
            q = (abs(d_num) / d_sig).to_integral_value(rounding=ROUND_FLOOR)
            return float(-q * d_sig)

        if fn == "FLOOR":
            self._require_arity(fn, args, 2, 2)
            num = self._to_num(args[0], expr)
            sig = self._to_num(args[1], expr)
            if num == 0.0:
                return 0.0
            if sig == 0.0:
                raise FormulaEvaluationError(f"#DIV/0! FLOOR significance cannot be zero in {expr!r}")
            if num > 0.0 and sig < 0.0:
                raise FormulaEvaluationError(f"#NUM! FLOOR positive number {num} with negative significance {sig}")
            d_num = Decimal(str(num))
            d_sig = Decimal(str(sig))
            if d_num > 0 and d_sig > 0:
                q = (d_num / d_sig).to_integral_value(rounding=ROUND_FLOOR)
                return float(q * d_sig)
            if d_num < 0 and d_sig < 0:
                q = (abs(d_num) / abs(d_sig)).to_integral_value(rounding=ROUND_FLOOR)
                return float(q * d_sig)
            q = (abs(d_num) / d_sig).to_integral_value(rounding=ROUND_CEILING)
            return float(-q * d_sig)

        if fn == "MOD":
            self._require_arity(fn, args, 2, 2)
            num = self._to_num(args[0], expr)
            div = self._to_num(args[1], expr)
            if div == 0.0:
                raise FormulaEvaluationError(f"#DIV/0! MOD by zero in {expr!r}")
            d_num = Decimal(str(num))
            d_div = Decimal(str(div))
            q = (d_num / d_div).to_integral_value(rounding=ROUND_FLOOR)
            return float(d_num - d_div * q)

        if fn == "INDEX":
            self._require_arity(fn, args, 2, 3)
            grid = args[0] if isinstance(args[0], RangeGrid) else RangeGrid(((args[0],),))
            row_idx = math.trunc(self._to_num(args[1], expr))
            if len(args) == 3:
                col_idx = math.trunc(self._to_num(args[2], expr))
            elif grid.nrows == 1 and grid.ncols > 1:
                col_idx = row_idx
                row_idx = 1
            else:
                col_idx = 1
            if row_idx < 1 or row_idx > grid.nrows or col_idx < 1 or col_idx > grid.ncols:
                raise FormulaEvaluationError(
                    f"#REF! INDEX ({row_idx}, {col_idx}) out of bounds for {grid.nrows}x{grid.ncols} range"
                )
            cell_val = grid.values[row_idx - 1][col_idx - 1]
            return 0.0 if cell_val is None else cell_val

        if fn == "MATCH":
            self._require_arity(fn, args, 2, 3)
            lookup_val = self._unwrap_scalar(args[0], expr)
            grid = args[1] if isinstance(args[1], RangeGrid) else RangeGrid(((args[1],),))
            if grid.nrows > 1 and grid.ncols > 1:
                raise FormulaEvaluationError("#N/A MATCH requires a 1D row or column range")
            seq = grid.flat()
            match_type = math.trunc(self._to_num(args[2], expr)) if len(args) == 3 else 1
            if match_type not in (-1, 0, 1):
                raise FormulaEvaluationError(f"#N/A Invalid MATCH match_type {match_type}")
            if lookup_val is None:
                raise FormulaEvaluationError("#N/A MATCH lookup_value cannot be blank")

            if match_type == 0:
                if isinstance(lookup_val, str):
                    glob_pat, has_wild = _excel_Criteria_wildcard_to_glob(lookup_val.lower())
                    for idx_1, item in enumerate(seq, start=1):
                        if isinstance(item, str):
                            low = item.lower()
                            if (has_wild and fnmatch.fnmatchcase(low, glob_pat)) or (not has_wild and low == glob_pat):
                                return idx_1
                else:
                    for idx_1, item in enumerate(seq, start=1):
                        if item is not None and self._type_rank(item) == self._type_rank(lookup_val):
                            return idx_1
                raise FormulaEvaluationError(f"#N/A MATCH exact value {lookup_val!r} not found")

            target_rank = self._type_rank(lookup_val)
            best_idx: int | None = None
            for idx_1, item in enumerate(seq, start=1):
                if item is None:
                    continue
                item_rank = self._type_rank(item)
                if item_rank[0] != target_rank[0]:
                    continue
                if match_type == 1:
                    if item_rank <= target_rank:
                        best_idx = idx_1
                    else:
                        break
                else:
                    if item_rank >= target_rank:
                        best_idx = idx_1
                    else:
                        break
            if best_idx is None:
                raise FormulaEvaluationError(f"#N/A MATCH approximate value {lookup_val!r} not found")
            return best_idx

        if fn == "LEN":
            self._require_arity(fn, args, 1, 1)
            return len(self._to_excel_str(args[0], expr))

        if fn == "LOWER":
            self._require_arity(fn, args, 1, 1)
            return self._to_excel_str(args[0], expr).lower()

        if fn == "UPPER":
            self._require_arity(fn, args, 1, 1)
            return self._to_excel_str(args[0], expr).upper()

        if fn == "TRIM":
            self._require_arity(fn, args, 1, 1)
            txt = self._to_excel_str(args[0], expr)
            return re.sub(r" +", " ", txt.strip(" "))

        if fn == "TEXT":
            self._require_arity(fn, args, 2, 2)
            num_val = self._to_num(args[0], expr)
            fmt_txt = self._to_excel_str(args[1], expr)
            return _format_excel_text(num_val, fmt_txt)

        if fn == "ISNUMBER":
            self._require_arity(fn, args, 1, 1)
            v = self._unwrap_scalar(args[0], expr)
            return isinstance(v, (int, float, Decimal)) and not isinstance(v, bool)

        if fn == "ISTEXT":
            self._require_arity(fn, args, 1, 1)
            v = self._unwrap_scalar(args[0], expr)
            return isinstance(v, str)

        if fn == "ISBLANK":
            self._require_arity(fn, args, 1, 1)
            v = self._unwrap_scalar(args[0], expr)
            return v is None

        raise UnsupportedFormulaError(f"Unsupported Excel function {fn!r} in formula: {expr!r}")

    def evaluate_all(self) -> dict[tuple[str, int, int], Any]:
        """Evaluate every populated formula cell across all sheets without scanning blank rectangles."""
        formula_results: dict[tuple[str, int, int], Any] = {}
        evaluated_count = 0
        for sh in self.wb.sheetnames:
            ws = self.wb[sh]
            cells_map = getattr(ws, "_cells", None)
            if self._formula_coords_by_sheet is not None:
                candidate_coords: Sequence[tuple[int, int]] = self._formula_coords_by_sheet.get(sh, ())
            elif isinstance(cells_map, dict):
                candidate_coords = sorted(cells_map.keys())
            else:
                area = ws.max_row * ws.max_column
                if area > MAX_RANGE_EVAL_CELLS:
                    raise FormulaEvaluationError(
                        f"Worksheet {sh!r} rectangle ({ws.max_row}x{ws.max_column}) exceeds scan budget "
                        f"{MAX_RANGE_EVAL_CELLS}"
                    )
                candidate_coords = [(r, c) for r in range(1, ws.max_row + 1) for c in range(1, ws.max_column + 1)]

            for r, c in candidate_coords:
                if isinstance(cells_map, dict):
                    cell_obj = cells_map.get((r, c))
                    v = cell_obj.value if cell_obj is not None else None
                else:
                    v = ws.cell(r, c).value
                if isinstance(v, (ArrayFormula, DataTableFormula)):
                    coord = f"{get_column_letter(c)}{r}"
                    raise UnsupportedFormulaError(f"Array or data-table formula at {sh}!{coord} is not supported")
                if isinstance(v, str) and v.startswith("="):
                    evaluated_count += 1
                    if evaluated_count > MAX_FORMULA_CELLS_PER_WORKBOOK:
                        raise FormulaEvaluationError(
                            f"Workbook formula count exceeds safety budget {MAX_FORMULA_CELLS_PER_WORKBOOK}"
                        )
                    res = self.eval_cell(sh, r, c)
                    formula_results[(sh, r, c)] = res
        return formula_results


# ============================================================================
# OOXML Relationship Resolution, Shared/Array Guards, & <v> Cache Injection
# ============================================================================


def _local_name(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag


def _detect_spreadsheet_ns(root: ET.Element) -> str:
    if root.tag.startswith("{"):
        return root.tag[1 : root.tag.index("}")]
    return NS_SPREADSHEET_MAIN


def _resolve_opc_target(base_dir: str, target: str, archive_names: set[str]) -> str:
    """Resolve an OPC Relationship Target relative to ``xl/workbook.xml`` safely."""
    if target.startswith("/"):
        rel = target.lstrip("/")
        validate_archive_member_name(rel)
        return rel

    joined_parts: list[str] = [p for p in PurePosixPath(base_dir).parts if p not in ("", ".")]
    for part in PurePosixPath(target).parts:
        if part in ("", "."):
            continue
        if part == "..":
            if not joined_parts:
                raise ContainmentError(f"Relationship target {target!r} escapes archive root")
            joined_parts.pop()
        else:
            joined_parts.append(part)

    candidate = "/".join(joined_parts)
    validate_archive_member_name(candidate)
    if candidate in archive_names:
        return candidate
    # Handle writers that emit 'xl/worksheets/sheet1.xml' without leading slash
    validate_archive_member_name(target)
    if target in archive_names:
        return target
    raise ContainmentError(f"Worksheet relationship target {target!r} (resolved {candidate!r}) missing from archive")


def resolve_sheet_xml_paths(zf: zipfile.ZipFile) -> dict[str, str]:
    """Map worksheet display names (in workbook order) to exact archive XML paths via workbook.xml.rels."""
    archive_names = set(zf.namelist())
    if "xl/workbook.xml" not in archive_names:
        raise ContainmentError("Invalid .xlsx archive: missing xl/workbook.xml")
    if "xl/_rels/workbook.xml.rels" not in archive_names:
        raise ContainmentError("Invalid .xlsx archive: missing xl/_rels/workbook.xml.rels")

    wb_root = parse_safe_xml_bytes(read_safe_zip_bytes(zf, "xl/workbook.xml"))
    rels_root = parse_safe_xml_bytes(read_safe_zip_bytes(zf, "xl/_rels/workbook.xml.rels"))

    rel_targets: dict[str, str] = {}
    for rel_el in rels_root:
        if _local_name(rel_el.tag) != "Relationship":
            continue
        r_id = rel_el.attrib.get("Id", "")
        target = rel_el.attrib.get("Target", "")
        target_mode = rel_el.attrib.get("TargetMode", "")
        if target_mode.lower() == "external":
            raise UnsupportedFormulaError(f"External workbook relationship {r_id!r} -> {target!r} is not supported")
        if r_id and target:
            rel_targets[r_id] = target

    sheet_paths: dict[str, str] = {}
    for el in wb_root.iter():
        if _local_name(el.tag) != "sheet":
            continue
        name = el.attrib.get("name")
        r_id = (
            el.attrib.get(f"{{{NS_OFFICE_RELS}}}id")
            or el.attrib.get(f"{{{NS_OFFICE_RELS_STRICT}}}id")
            or el.attrib.get("id")
        )
        if not name or not r_id:
            continue
        if r_id not in rel_targets:
            raise ContainmentError(f"Worksheet {name!r} references missing relationship Id={r_id!r}")
        xml_member = _resolve_opc_target("xl", rel_targets[r_id], archive_names)
        sheet_paths[name] = xml_member

    if not sheet_paths:
        raise ContainmentError("No worksheet entries discovered in xl/workbook.xml")
    return sheet_paths


def _decoded_header_footer_length(text: str) -> int:
    decoded = _OOXML_HEX_ESCAPE_RE.sub("\r", text)
    return max(len(text), len(decoded))


def _truncate_header_footer_text(text: str, limit: int = MAX_HEADER_FOOTER_CHARS) -> str:
    normalized = _OOXML_HEX_ESCAPE_RE.sub(lambda m: f"_x{m.group(1).upper()}_", text)
    if _decoded_header_footer_length(normalized) <= limit:
        return normalized
    clipped = normalized[: limit - 3]
    # Avoid slicing through a trailing _x000D_ escape sequence
    partial_esc = re.search(r"_x[0-9A-Fa-f]{0,4}$", clipped)
    if partial_esc:
        clipped = clipped[: partial_esc.start()]
    return f"{clipped}..."


def _format_numeric_cache(val: int | float | Decimal) -> str:
    """Format a finite number cleanly for OOXML ``<v>`` without avoidable scientific notation."""
    if isinstance(val, int) and not isinstance(val, bool):
        return str(val)
    fval = float(val)
    if math.isnan(fval) or math.isinf(fval):
        raise FormulaEvaluationError(f"#NUM! Cannot cache non-finite numeric value {val!r}")
    if fval == 0.0:
        return "0"
    d_val = val if isinstance(val, Decimal) else Decimal(str(fval))
    norm = d_val.normalize()
    if norm == norm.to_integral_value() and abs(fval) < 1e15:
        return str(int(norm))
    if 1e-12 <= abs(fval) < 1e15:
        fixed = format(norm, "f")
        if "." in fixed:
            fixed = fixed.rstrip("0").rstrip(".")
        return fixed or "0"
    return repr(fval)


def _scan_ooxml_formulas_and_headers(
    zf: zipfile.ZipFile,
    sheet_paths: dict[str, str],
    *,
    enforce_header_limit: bool = True,
) -> tuple[dict[tuple[str, str], str], list[dict[str, Any]], dict[str, list[tuple[int, int]]]]:
    """Scan all worksheet XMLs for array/shared formulas, formula coordinates, and >255-char headers/footers.

    Returns ``(resolved_shared_followers, header_footer_findings, formula_coords_by_sheet)`` where
    ``resolved_shared_followers`` maps ``(sheet_name, coord) -> '=translated_formula'`` and
    ``formula_coords_by_sheet`` maps ``sheet_name -> sorted [(row, col), ...]``.
    """
    shared_followers: dict[tuple[str, str], str] = {}
    hf_findings: list[dict[str, Any]] = []
    formula_coords_by_sheet: dict[str, list[tuple[int, int]]] = {}
    total_formula_cells = 0

    for sheet_name, xml_path in sheet_paths.items():
        raw_bytes = read_safe_zip_bytes(zf, xml_path)
        root = parse_safe_xml_bytes(raw_bytes)

        # Pass 1: collect shared formula masters on this sheet
        shared_masters: dict[str, tuple[str, str]] = {}
        formula_cells: list[tuple[str, ET.Element]] = []
        sheet_coords: set[tuple[int, int]] = set()

        for c_el in root.iter():
            if _local_name(c_el.tag) != "c":
                continue
            coord = c_el.attrib.get("r", "")
            f_el = next((ch for ch in c_el if _local_name(ch.tag) == "f"), None)
            if f_el is None:
                continue
            formula_cells.append((coord, f_el))
            f_type = f_el.attrib.get("t", "normal")
            if f_type in ("array", "dataTable"):
                raise UnsupportedFormulaError(
                    f"Unsupported OOXML formula type t={f_type!r} at {sheet_name}!{coord} ({xml_path})"
                )
            if f_type == "shared":
                si = f_el.attrib.get("si")
                inline_txt = (f_el.text or "").strip()
                if inline_txt and si is not None:
                    shared_masters[si] = (coord, inline_txt)

        # Pass 2: resolve shared formula followers or fail closed if master missing
        for coord, f_el in formula_cells:
            if not coord:
                raise UnsupportedFormulaError(f"Formula cell missing 'r' coordinate attribute in {xml_path}")
            r_idx, c_idx = _parse_coord(coord)
            sheet_coords.add((r_idx, c_idx))
            total_formula_cells += 1
            if total_formula_cells > MAX_FORMULA_CELLS_PER_WORKBOOK:
                raise FormulaEvaluationError(
                    f"Workbook formula count ({total_formula_cells}) exceeds safety budget "
                    f"{MAX_FORMULA_CELLS_PER_WORKBOOK}"
                )
            f_type = f_el.attrib.get("t", "normal")
            inline_txt = (f_el.text or "").strip()
            if f_type == "shared" and not inline_txt:
                si = f_el.attrib.get("si")
                if si is None or si not in shared_masters:
                    raise UnsupportedFormulaError(
                        f"Unresolved shared formula (si={si!r}) without master formula at {sheet_name}!{coord}"
                    )
                master_coord, master_formula = shared_masters[si]
                try:
                    translated = Translator(f"={master_formula}", origin=master_coord).translate_formula(coord)
                except Exception as exc:
                    raise UnsupportedFormulaError(
                        f"Failed to translate shared formula si={si!r} from {master_coord} to {sheet_name}!{coord}: {exc}"
                    ) from exc
                shared_followers[(sheet_name, coord)] = translated
            elif f_type == "normal" and not inline_txt:
                raise UnsupportedFormulaError(f"Empty <f> element at {sheet_name}!{coord}")

        formula_coords_by_sheet[sheet_name] = sorted(sheet_coords)

        # Pass 3: inspect headerFooter child elements
        for hf_el in root.iter():
            if _local_name(hf_el.tag) != "headerFooter":
                continue
            for ch in hf_el:
                tag_name = _local_name(ch.tag)
                if tag_name not in HEADER_FOOTER_TAGS:
                    continue
                txt = ch.text or ""
                char_len = _decoded_header_footer_length(txt) if txt else 0
                finding = {
                    "sheet": sheet_name,
                    "xml_path": xml_path,
                    "tag": tag_name,
                    "length": char_len,
                    "empty": txt == "",
                    "preview": txt[:80],
                }
                hf_findings.append(finding)
                if enforce_header_limit and txt and char_len > MAX_HEADER_FOOTER_CHARS:
                    raise HeaderFooterLimitError(
                        f"Worksheet {sheet_name!r} <{tag_name}> length {char_len} exceeds Desktop Excel "
                        f"{MAX_HEADER_FOOTER_CHARS}-char limit (preview: {txt[:80]!r}). "
                        f"Shorten the header/footer or pass --truncate-long-footers explicitly."
                    )

    return shared_followers, hf_findings, formula_coords_by_sheet


def _apply_shared_followers_to_workbook(
    wb: openpyxl.Workbook,
    shared_followers: dict[tuple[str, str], str],
) -> None:
    for (sheet_name, coord), formula_str in shared_followers.items():
        if sheet_name in wb.sheetnames:
            wb[sheet_name][coord].value = formula_str


def _verify_parity_against_data_only(
    xlsx_path: Path,
    ast_results: dict[tuple[str, int, int], Any],
) -> int:
    """Re-open ``xlsx_path`` with ``data_only=True`` and assert 100% value parity with ``ast_results``."""
    wb_val = openpyxl.load_workbook(xlsx_path, data_only=True)
    try:
        verified = 0
        for (sh, r, c), exp in ast_results.items():
            coord = f"{get_column_letter(c)}{r}"
            cached = wb_val[sh].cell(r, c).value
            if isinstance(cached, str) and cached.upper() in EXCEL_ERROR_TOKENS:
                raise CacheParityError(f"Cached Excel error token {cached!r} at {sh}!{coord}")
            if isinstance(exp, bool):
                if not isinstance(cached, bool) or cached != exp:
                    raise CacheParityError(f"Boolean <v> mismatch at {sh}!{coord}: AST={exp!r}, cached={cached!r}")
            elif isinstance(exp, (int, float, Decimal)):
                if not isinstance(cached, (int, float, Decimal)) or isinstance(cached, bool):
                    raise CacheParityError(f"Numeric <v> mismatch at {sh}!{coord}: AST={exp!r}, cached={cached!r}")
                tol = max(1e-5, abs(float(exp)) * 1e-9)
                if abs(float(cached) - float(exp)) > tol:
                    raise CacheParityError(f"Numeric <v> mismatch at {sh}!{coord}: AST={exp!r}, cached={cached!r}")
            elif isinstance(exp, str):
                if exp == "":
                    if cached not in (None, ""):
                        raise CacheParityError(f"Empty-string <v> mismatch at {sh}!{coord}: AST='', cached={cached!r}")
                elif cached != exp:
                    raise CacheParityError(f"String <v> mismatch at {sh}!{coord}: AST={exp!r}, cached={cached!r}")
            elif exp is None:
                if cached not in (None, 0, 0.0, ""):
                    raise CacheParityError(f"Null <v> mismatch at {sh}!{coord}: AST=None, cached={cached!r}")
            else:
                raise CacheParityError(f"Unsupported expected value type {type(exp).__name__} at {sh}!{coord}")
            verified += 1
        return verified
    finally:
        wb_val.close()


def _verify_with_libreoffice(
    xlsx_path: Path,
    ast_results: dict[tuple[str, int, int], Any],
) -> dict[str, Any]:
    """Cross-check numeric formula cells against LibreOffice Calc headless engine when installed."""
    soffice_bin = shutil.which("soffice")
    if soffice_bin is None:
        return {
            "authoritative_engine_checked": False,
            "engine": None,
            "status": "soffice not found on PATH; verified deterministic AST and <v> parity only",
        }

    with tempfile.TemporaryDirectory(prefix=".soffice_check_", dir=xlsx_path.parent) as work_dir_str:
        work_dir = Path(work_dir_str)
        profile_uri = (work_dir / "lo_profile").resolve().as_uri()
        out_dir = work_dir / "out"
        out_dir.mkdir(parents=True, exist_ok=True)
        cmd = [
            soffice_bin,
            "--headless",
            "--norestore",
            f"-env:UserInstallation={profile_uri}",
            "--convert-to",
            "xlsx",
            "--outdir",
            str(out_dir),
            str(xlsx_path),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=90, check=False)
        recalc_path = out_dir / xlsx_path.name
        if proc.returncode != 0 or not recalc_path.is_file():
            raise CacheParityError(
                f"LibreOffice headless recalculation failed (exit {proc.returncode}): {proc.stderr.strip()}"
            )

        wb_lo = openpyxl.load_workbook(recalc_path, data_only=True)
        try:
            checked_numeric = 0
            for (sh, r, c), exp in ast_results.items():
                if isinstance(exp, (int, float, Decimal)) and not isinstance(exp, bool):
                    lo_val = wb_lo[sh].cell(r, c).value
                    coord = f"{get_column_letter(c)}{r}"
                    if not isinstance(lo_val, (int, float, Decimal)) or isinstance(lo_val, bool):
                        raise CacheParityError(
                            f"LibreOffice parity mismatch at {sh}!{coord}: AST={exp!r}, soffice={lo_val!r}"
                        )
                    tol = max(1e-4, abs(float(exp)) * 1e-7)
                    if abs(float(lo_val) - float(exp)) > tol:
                        raise CacheParityError(
                            f"LibreOffice parity mismatch at {sh}!{coord}: AST={exp!r}, soffice={lo_val!r}"
                        )
                    checked_numeric += 1
        finally:
            wb_lo.close()

    return {
        "authoritative_engine_checked": True,
        "engine": soffice_bin,
        "numeric_cells_checked": checked_numeric,
        "status": "ok",
    }


def run_permutation_checks(
    xlsx_path: Path,
    permutations: dict[str, list[Any]],
    *,
    max_combinations: int = 1024,
) -> dict[str, Any]:
    """Verify zero formula errors across cartesian-product mutations of control cells."""
    if not permutations:
        return {"combinations_tested": 0, "cells": []}

    with open_validated_zip(xlsx_path) as zf:
        sheet_paths = resolve_sheet_xml_paths(zf)
        shared_followers, _, formula_coords_by_sheet = _scan_ooxml_formulas_and_headers(
            zf,
            sheet_paths,
            enforce_header_limit=False,
        )

    parsed_targets: list[tuple[str, int, int, list[Any]]] = []
    total_combos = 1
    for spec, values in permutations.items():
        if not isinstance(values, list) or not values:
            raise ValueError(f"Permutation entry for {spec!r} must be a non-empty list")
        sh, r, c = _parse_sheet_cell_spec(spec)
        total_combos *= len(values)
        if total_combos > max_combinations:
            raise ValueError(f"Permutation count {total_combos} exceeds safety limit {max_combinations}")
        parsed_targets.append((sh, r, c, values))

    wb_base = openpyxl.load_workbook(xlsx_path, data_only=False)
    try:
        _apply_shared_followers_to_workbook(wb_base, shared_followers)
        for sh, _, _, _ in parsed_targets:
            if sh not in wb_base.sheetnames:
                raise ValueError(f"Permutation target sheet {sh!r} not in workbook {wb_base.sheetnames}")

        value_lists = [item[3] for item in parsed_targets]
        tested = 0
        for combo in itertools.product(*value_lists):
            wb_mut = copy.deepcopy(wb_base)
            for (sh, r, c, _), new_val in zip(parsed_targets, combo, strict=True):
                wb_mut[sh].cell(r, c).value = new_val
            evaluator = WorkbookEvaluator(wb_mut, formula_coords_by_sheet=formula_coords_by_sheet)
            evaluator.evaluate_all()
            tested += 1
    finally:
        wb_base.close()

    return {
        "combinations_tested": tested,
        "cells": list(permutations.keys()),
    }


def _capture_xml_namespaces(raw_bytes: bytes) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    """Capture ``(all_ns_decls, root_ns_decls)`` from ``raw_bytes`` via ``ET.iterparse(events=('start-ns', 'start'))``."""
    all_ns: list[tuple[str, str]] = []
    root_ns: list[tuple[str, str]] = []
    saw_root_start = False
    for event, payload in ET.iterparse(io.BytesIO(raw_bytes), events=("start-ns", "start")):
        if event == "start-ns":
            prefix, uri = payload
            all_ns.append((prefix, uri))
            if not saw_root_start:
                root_ns.append((prefix, uri))
        elif event == "start":
            saw_root_start = True
    return all_ns, root_ns


def _serialize_worksheet_preserving_namespaces(
    root: ET.Element,
    ns: str,
    all_ns_decls: Sequence[tuple[str, str]],
    root_ns_decls: Sequence[tuple[str, str]],
) -> bytes:
    """Serialize ``root`` while preserving original namespace prefixes and ``mc:Ignorable`` bindings."""
    reg_prefixes: set[str] = set()
    reg_uris: set[str] = set()
    for prefix, uri in itertools.chain(root_ns_decls, all_ns_decls):
        if prefix in ("xml", "xmlns") or re.match(r"^ns\d+$", prefix):
            continue
        if prefix not in reg_prefixes and uri not in reg_uris:
            reg_prefixes.add(prefix)
            reg_uris.add(uri)
            ET.register_namespace(prefix, uri)

    if "" not in reg_prefixes and ns not in reg_uris:
        ET.register_namespace("", ns)
    if "r" not in reg_prefixes and NS_OFFICE_RELS not in reg_uris:
        ET.register_namespace("r", NS_OFFICE_RELS)

    body_xml = ET.tostring(root, encoding="unicode")

    prefix_to_uri: dict[str, str] = {}
    for prefix, uri in reversed(all_ns_decls):
        if prefix and prefix not in ("xml", "xmlns"):
            prefix_to_uri[prefix] = uri
    for prefix, uri in reversed(root_ns_decls):
        if prefix and prefix not in ("xml", "xmlns"):
            prefix_to_uri[prefix] = uri

    required_root_prefixes: list[str] = []
    for prefix, _ in root_ns_decls:
        if prefix and prefix not in ("xml", "xmlns") and prefix not in required_root_prefixes:
            required_root_prefixes.append(prefix)
    for el in root.iter():
        for attr_k, attr_v in el.attrib.items():
            if _local_name(attr_k) == "Ignorable":
                for tok in attr_v.split():
                    if tok and tok not in required_root_prefixes:
                        required_root_prefixes.append(tok)

    if required_root_prefixes:
        in_quote: str | None = None
        open_end = -1
        for idx_ch, ch in enumerate(body_xml):
            if in_quote is not None:
                if ch == in_quote:
                    in_quote = None
            elif ch in ('"', "'"):
                in_quote = ch
            elif ch == ">":
                open_end = idx_ch
                break

        if open_end != -1:
            is_self_closing = open_end > 0 and body_xml[open_end - 1] == "/"
            insert_pos = open_end - 1 if is_self_closing else open_end
            open_tag_slice = body_xml[:insert_pos]
            restored_attrs: list[str] = []
            for prefix in required_root_prefixes:
                uri = prefix_to_uri.get(prefix)
                if not uri:
                    continue
                if not re.search(rf"(?:^|\s)xmlns:{re.escape(prefix)}\s*=", open_tag_slice):
                    escaped_uri = (
                        uri.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
                    )
                    restored_attrs.append(f' xmlns:{prefix}="{escaped_uri}"')
            if restored_attrs:
                body_xml = body_xml[:insert_pos] + "".join(restored_attrs) + body_xml[insert_pos:]

    body_xml = _OOXML_HEX_ESCAPE_RE.sub(lambda m: f"_x{m.group(1).upper()}_", body_xml)
    xml_decl = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    rewritten_bytes = (xml_decl + body_xml).encode("utf-8")
    parse_safe_xml_bytes(rewritten_bytes)
    return rewritten_bytes


def inject_and_verify_caches(
    xlsx_path: Path,
    *,
    output_path: Path | None = None,
    truncate_long_footers: bool = False,
    verify_with_soffice: bool = False,
    permutations: dict[str, list[Any]] | None = None,
) -> dict[str, Any]:
    """Evaluate all formulas, inject typed OOXML ``<v>`` caches, enforce header limits, and verify parity."""
    target_path = output_path if output_path is not None else xlsx_path
    if target_path.exists() and target_path.is_symlink():
        raise ContainmentError(f"Refusing to overwrite symlink output workbook: {target_path}")

    with open_validated_zip(xlsx_path) as zf:
        sheet_paths = resolve_sheet_xml_paths(zf)
        shared_followers, hf_findings, formula_coords_by_sheet = _scan_ooxml_formulas_and_headers(
            zf,
            sheet_paths,
            enforce_header_limit=not truncate_long_footers,
        )

    wb_formulas = openpyxl.load_workbook(xlsx_path, data_only=False)
    try:
        _apply_shared_followers_to_workbook(wb_formulas, shared_followers)
        evaluator = WorkbookEvaluator(wb_formulas, formula_coords_by_sheet=formula_coords_by_sheet)
        ast_results = evaluator.evaluate_all()
    finally:
        wb_formulas.close()

    by_xml_member: dict[str, dict[str, Any]] = {xml_path: {} for xml_path in sheet_paths.values()}
    for (sh, r, c), val in ast_results.items():
        if sh not in sheet_paths:
            raise ContainmentError(f"Sheet {sh!r} missing from workbook.xml relationship map")
        coord = f"{get_column_letter(c)}{r}"
        by_xml_member[sheet_paths[sh]][coord] = val

    ET.register_namespace("", NS_SPREADSHEET_MAIN)
    ET.register_namespace("r", NS_OFFICE_RELS)

    stripped_empty_hf = 0
    truncated_hf = 0
    tmp_out = target_path.parent / f".{target_path.name}.ast_cache.tmp"
    try:
        with (
            open_validated_zip(xlsx_path) as zin,
            zipfile.ZipFile(tmp_out, mode="w", compression=zipfile.ZIP_DEFLATED) as zout,
        ):
            for info in zin.infolist():
                raw_data = read_safe_zip_bytes(zin, info.filename)
                if info.filename in by_xml_member:
                    cell_map = by_xml_member[info.filename]
                    root = parse_safe_xml_bytes(raw_data)
                    all_ns_decls, root_ns_decls = _capture_xml_namespaces(raw_data)
                    ns = _detect_spreadsheet_ns(root)
                    v_tag = f"{{{ns}}}v"

                    for c_el in root.iter(f"{{{ns}}}c"):
                        f_el = c_el.find(f"{{{ns}}}f")
                        if f_el is None:
                            continue
                        coord = c_el.attrib.get("r", "")
                        if coord not in cell_map:
                            continue
                        val = cell_map[coord]

                        # Remove any stale inline-string child on a formula cell
                        for is_el in list(c_el.findall(f"{{{ns}}}is")):
                            c_el.remove(is_el)

                        # Ensure <v> immediately follows <f> per SpreadsheetML CT_Cell XSD sequence
                        existing_v = c_el.find(v_tag)
                        if existing_v is not None:
                            c_el.remove(existing_v)
                        f_index = list(c_el).index(f_el)
                        v_el = ET.Element(v_tag)
                        c_el.insert(f_index + 1, v_el)

                        if isinstance(val, bool):
                            c_el.set("t", "b")
                            v_el.text = "1" if val else "0"
                        elif isinstance(val, (int, float, Decimal)):
                            c_el.attrib.pop("t", None)
                            v_el.text = _format_numeric_cache(val)
                        elif isinstance(val, str):
                            if val.upper() in EXCEL_ERROR_TOKENS:
                                raise FormulaEvaluationError(f"Refusing to cache error token {val!r} at {coord}")
                            c_el.set("t", "str")
                            v_el.text = val
                        elif val is None:
                            c_el.attrib.pop("t", None)
                            v_el.text = "0"
                        else:
                            c_el.set("t", "str")
                            v_el.text = str(val)

                    hf_el = root.find(f"{{{ns}}}headerFooter")
                    if hf_el is not None:
                        for ch in list(hf_el):
                            local = _local_name(ch.tag)
                            if local not in HEADER_FOOTER_TAGS:
                                continue
                            if ch.text is None or ch.text == "":
                                hf_el.remove(ch)
                                stripped_empty_hf += 1
                            elif _decoded_header_footer_length(ch.text) > MAX_HEADER_FOOTER_CHARS:
                                if not truncate_long_footers:
                                    raise HeaderFooterLimitError(
                                        f"Header/footer <{local}> in {info.filename} exceeds "
                                        f"{MAX_HEADER_FOOTER_CHARS} characters"
                                    )
                                ch.text = _truncate_header_footer_text(ch.text, MAX_HEADER_FOOTER_CHARS)
                                truncated_hf += 1
                        if len(hf_el) == 0 and not hf_el.attrib:
                            root.remove(hf_el)

                    raw_data = _serialize_worksheet_preserving_namespaces(root, ns, all_ns_decls, root_ns_decls)

                out_info = zipfile.ZipInfo(filename=info.filename, date_time=info.date_time)
                out_info.compress_type = zipfile.ZIP_DEFLATED
                out_info.external_attr = info.external_attr
                zout.writestr(out_info, raw_data)

        os.replace(tmp_out, target_path)
    finally:
        ET.register_namespace("", NS_SPREADSHEET_MAIN)
        ET.register_namespace("r", NS_OFFICE_RELS)
        if tmp_out.exists():
            tmp_out.unlink(missing_ok=True)

    with open_validated_zip(target_path) as zcheck:
        bad_member = zcheck.testzip()
        if bad_member is not None:
            raise ContainmentError(f"Corrupt ZIP entry after cache injection: {bad_member}")

    verified_count = _verify_parity_against_data_only(target_path, ast_results)
    perm_summary = (
        run_permutation_checks(target_path, permutations) if permutations else {"combinations_tested": 0, "cells": []}
    )
    engine_summary = (
        _verify_with_libreoffice(target_path, ast_results)
        if verify_with_soffice
        else {"authoritative_engine_checked": False, "engine": None, "status": "not requested"}
    )

    return {
        "workbook": str(target_path),
        "sheets": list(sheet_paths.keys()),
        "sheet_xml_paths": sheet_paths,
        "formulas_evaluated": len(ast_results),
        "shared_formulas_resolved": len(shared_followers),
        "cached_values_verified": verified_count,
        "empty_headers_stripped": stripped_empty_hf,
        "headers_truncated": truncated_hf,
        "header_footer_findings": hf_findings,
        "permutations": perm_summary,
        "authoritative_engine_checked": bool(engine_summary["authoritative_engine_checked"]),
        "soffice": engine_summary,
    }


def verify_workbook_caches(
    xlsx_path: Path,
    *,
    verify_with_soffice: bool = False,
    permutations: dict[str, list[Any]] | None = None,
) -> dict[str, Any]:
    """Read-only verification of OOXML containment, AST formulas, ``<v>`` parity, and ``<=255`` headers/footers."""
    with open_validated_zip(xlsx_path) as zf:
        bad_member = zf.testzip()
        if bad_member is not None:
            raise ContainmentError(f"Corrupt ZIP entry in {xlsx_path.name}: {bad_member}")
        sheet_paths = resolve_sheet_xml_paths(zf)
        shared_followers, hf_findings, formula_coords_by_sheet = _scan_ooxml_formulas_and_headers(
            zf,
            sheet_paths,
            enforce_header_limit=True,
        )

    wb_formulas = openpyxl.load_workbook(xlsx_path, data_only=False)
    try:
        _apply_shared_followers_to_workbook(wb_formulas, shared_followers)
        evaluator = WorkbookEvaluator(wb_formulas, formula_coords_by_sheet=formula_coords_by_sheet)
        ast_results = evaluator.evaluate_all()
    finally:
        wb_formulas.close()

    verified_count = _verify_parity_against_data_only(xlsx_path, ast_results)
    perm_summary = (
        run_permutation_checks(xlsx_path, permutations) if permutations else {"combinations_tested": 0, "cells": []}
    )
    engine_summary = (
        _verify_with_libreoffice(xlsx_path, ast_results)
        if verify_with_soffice
        else {"authoritative_engine_checked": False, "engine": None, "status": "not requested"}
    )

    return {
        "workbook": str(xlsx_path),
        "sheets": list(sheet_paths.keys()),
        "sheet_xml_paths": sheet_paths,
        "formulas_evaluated": len(ast_results),
        "shared_formulas_resolved": len(shared_followers),
        "cached_values_verified": verified_count,
        "header_footer_findings": hf_findings,
        "permutations": perm_summary,
        "authoritative_engine_checked": bool(engine_summary["authoritative_engine_checked"]),
        "soffice": engine_summary,
    }


# ============================================================================
# Non-Destructive Customer Template Preservation Diff (RD-04)
# ============================================================================

_PROTECTION_LOCK_DEFAULT_TRUE_ATTRS: tuple[str, ...] = (
    "formatCells",
    "formatColumns",
    "formatRows",
    "insertColumns",
    "insertRows",
    "insertHyperlinks",
    "deleteColumns",
    "deleteRows",
    "sort",
    "autoFilter",
    "pivotTables",
)


_WORKBOOK_PROTECTION_BOOL_FLAGS: frozenset[str] = frozenset({"lockStructure", "lockWindows", "lockRevision"})
_SIMPLE_SHEET_IDENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_.]*$")
_CELL_LIKE_RE = re.compile(r"^[A-Za-z]{1,3}[1-9]\d*$")


def _xml_bool(val: str | None, *, default: bool) -> bool:
    if val is None:
        return default
    return val.strip().lower() in ("1", "true")


def _normalize_excel_expr(expr: str) -> str:
    """Normalize an Excel formula, defined-name, or validation expression while preserving string literals."""
    stripped = expr.strip()
    if not stripped:
        return ""
    body = stripped[1:].strip() if stripped.startswith("=") else stripped
    out: list[str] = []
    idx = 0
    n = len(body)

    while idx < n:
        ch = body[idx]
        if ch == '"':
            end = idx + 1
            while end < n:
                if body[end] == '"':
                    if end + 1 < n and body[end + 1] == '"':
                        end += 2
                        continue
                    end += 1
                    break
                end += 1
            out.append(body[idx:end])
            idx = end
        elif ch == "'":
            end = idx + 1
            while end < n:
                if body[end] == "'":
                    if end + 1 < n and body[end + 1] == "'":
                        end += 2
                        continue
                    end += 1
                    break
                end += 1
            raw_quoted = body[idx:end]
            if len(raw_quoted) >= 2 and raw_quoted.endswith("'"):
                inner = raw_quoted[1:-1].replace("''", "'")
                if _SIMPLE_SHEET_IDENT_RE.match(inner) and not _CELL_LIKE_RE.match(inner):
                    out.append(inner.upper())
                else:
                    escaped = inner.upper().replace("'", "''")
                    out.append(f"'{escaped}'")
            else:
                out.append(raw_quoted.upper())
            idx = end
        elif ch.isspace():
            idx += 1
        else:
            out.append(ch.upper())
            idx += 1

    normalized = "".join(out)
    return re.sub(r"(?<![A-Z0-9_.])_XLFN\.", "", normalized)


def _extract_workbook_defined_names(
    zf: zipfile.ZipFile,
    sheet_names: list[str],
) -> dict[tuple[str, str], dict[str, Any]]:
    """Extract ``(name_lower, scope_sheet_or_global) -> {expr, raw, hidden}`` from ``xl/workbook.xml``."""
    wb_root = parse_safe_xml_bytes(read_safe_zip_bytes(zf, "xl/workbook.xml"))
    names: dict[tuple[str, str], dict[str, Any]] = {}
    for el in wb_root.iter():
        if _local_name(el.tag) != "definedName":
            continue
        raw_name = el.attrib.get("name", "")
        if not raw_name:
            continue
        local_id = el.attrib.get("localSheetId")
        scope = "*GLOBAL*"
        if local_id is not None:
            idx = int(local_id)
            scope = sheet_names[idx] if 0 <= idx < len(sheet_names) else f"sheetIndex:{idx}"
        raw_expr = (el.text or "").strip()
        names[(raw_name.lower(), scope)] = {
            "expr": _normalize_excel_expr(raw_expr),
            "raw": raw_expr,
            "hidden": _xml_bool(el.attrib.get("hidden"), default=False),
        }
    return names


def _extract_workbook_metadata(
    zf: zipfile.ZipFile,
) -> tuple[dict[str, dict[str, str]], dict[str, str] | None]:
    """Extract per-sheet ``(sheetId, state)`` metadata and ``<workbookProtection>`` from ``xl/workbook.xml``."""
    wb_root = parse_safe_xml_bytes(read_safe_zip_bytes(zf, "xl/workbook.xml"))
    sheet_meta: dict[str, dict[str, str]] = {}
    wb_protection: dict[str, str] | None = None
    for el in wb_root.iter():
        lname = _local_name(el.tag)
        if lname == "sheet":
            name = el.attrib.get("name")
            if name:
                sheet_meta[name] = {
                    "sheetId": el.attrib.get("sheetId", "").strip(),
                    "state": (el.attrib.get("state") or "visible").strip(),
                }
        elif lname == "workbookProtection":
            wb_protection = dict(el.attrib)
    return sheet_meta, wb_protection


def _check_workbook_protection_regression(
    tmpl_wb_prot: dict[str, str] | None,
    out_wb_prot: dict[str, str] | None,
) -> list[str]:
    if tmpl_wb_prot is None:
        return []
    if out_wb_prot is None:
        return ["workbook: <workbookProtection> element was removed"]

    regressions: list[str] = []
    for flag in ("lockStructure", "lockWindows", "lockRevision"):
        if _xml_bool(tmpl_wb_prot.get(flag), default=False) and not _xml_bool(out_wb_prot.get(flag), default=False):
            regressions.append(f"workbook: workbookProtection {flag} was disabled")

    stripped_verifier = False
    altered_verifier = False
    for attr_key, tmpl_val in tmpl_wb_prot.items():
        if attr_key in _WORKBOOK_PROTECTION_BOOL_FLAGS or not tmpl_val:
            continue
        out_val = out_wb_prot.get(attr_key)
        if not out_val:
            stripped_verifier = True
        elif out_val != tmpl_val:
            altered_verifier = True
    if stripped_verifier:
        regressions.append("workbook: workbookProtection verifier attributes were stripped")
    if altered_verifier:
        regressions.append("workbook: workbookProtection verifier attributes were altered")
    return regressions


def _part_rels_location(part_path: str) -> tuple[str, str]:
    if not part_path:
        return "_rels/.rels", ""
    pure = PurePosixPath(part_path)
    parent = pure.parent.as_posix()
    if parent in ("", "."):
        return f"_rels/{pure.name}.rels", ""
    return f"{parent}/_rels/{pure.name}.rels", parent


def _extract_part_relationships(
    zf: zipfile.ZipFile,
    part_path: str,
    *,
    ignored_kinds: frozenset[str],
) -> tuple[list[dict[str, str]], list[str]]:
    """Extract non-ignored relationships for ``part_path`` and report any missing internal archive targets."""
    archive_names = set(zf.namelist())
    rels_member, base_dir = _part_rels_location(part_path)
    if rels_member not in archive_names:
        return [], []

    rels_root = parse_safe_xml_bytes(read_safe_zip_bytes(zf, rels_member))
    entries: list[dict[str, str]] = []
    dangling: list[str] = []

    for rel_el in rels_root:
        if _local_name(rel_el.tag) != "Relationship":
            continue
        rel_type = rel_el.attrib.get("Type", "").strip()
        rel_kind = rel_type.rsplit("/", 1)[-1]
        if rel_kind in ignored_kinds:
            continue
        target = rel_el.attrib.get("Target", "").strip()
        target_mode = rel_el.attrib.get("TargetMode", "").strip()
        if not target:
            continue
        if target_mode.lower() == "external":
            entries.append({"kind": rel_kind, "target": target, "external": "true"})
            continue

        try:
            resolved = _resolve_opc_target(base_dir, target, archive_names)
        except ContainmentError as exc:
            if "missing from archive" in str(exc):
                dangling.append(f"{rels_member}: missing target {target!r} ({rel_kind})")
                continue
            raise
        entries.append({"kind": rel_kind, "target": resolved, "external": "false"})

    return entries, dangling


def _extract_table_identity(zf: zipfile.ZipFile, table_xml_path: str) -> str:
    root = parse_safe_xml_bytes(read_safe_zip_bytes(zf, table_xml_path))
    return (root.attrib.get("displayName") or root.attrib.get("name") or table_xml_path).strip()


def _compare_non_worksheet_relationships(
    ztmpl: zipfile.ZipFile,
    zout: zipfile.ZipFile,
    tmpl_paths: dict[str, str],
    out_paths: dict[str, str],
) -> list[str]:
    """Check non-worksheet package, workbook, and template-sheet relationships and parts."""
    dropped: list[str] = []
    tmpl_archive = set(ztmpl.namelist())
    out_archive = set(zout.namelist())

    # 1. Package-level relationships (e.g. docProps/custom.xml, package customXml)
    pkg_ignored = frozenset({"officeDocument", "core-properties", "extended-properties", "thumbnail"})
    t_pkg_rels, _ = _extract_part_relationships(ztmpl, "", ignored_kinds=pkg_ignored)
    o_pkg_rels, o_pkg_dangling = _extract_part_relationships(zout, "", ignored_kinds=pkg_ignored)
    dropped.extend(o_pkg_dangling)
    o_pkg_pairs = {(r["kind"], r["target"]) for r in o_pkg_rels}
    for rel in t_pkg_rels:
        if (rel["kind"], rel["target"]) not in o_pkg_pairs:
            dropped.append(f"package: dropped {rel['kind']} relationship -> {rel['target']!r}")

    # 2. Workbook-level non-worksheet relationships (vbaProject, customXml, pivotCache, connections, etc.)
    wb_ignored = frozenset({"worksheet", "calcChain", "sharedStrings"})
    t_wb_rels, _ = _extract_part_relationships(ztmpl, "xl/workbook.xml", ignored_kinds=wb_ignored)
    o_wb_rels, o_wb_dangling = _extract_part_relationships(zout, "xl/workbook.xml", ignored_kinds=wb_ignored)
    dropped.extend(o_wb_dangling)

    t_wb_counts: dict[str, int] = {}
    o_wb_counts: dict[str, int] = {}
    for r in t_wb_rels:
        t_wb_counts[r["kind"]] = t_wb_counts.get(r["kind"], 0) + 1
    for r in o_wb_rels:
        o_wb_counts[r["kind"]] = o_wb_counts.get(r["kind"], 0) + 1

    o_wb_targets = {(r["kind"], r["target"]) for r in o_wb_rels}
    for kind, t_cnt in sorted(t_wb_counts.items()):
        o_cnt = o_wb_counts.get(kind, 0)
        if o_cnt < t_cnt:
            dropped.append(f"workbook: dropped {kind} relationship(s) (template={t_cnt}, output={o_cnt})")
    for r in t_wb_rels:
        if r["kind"] not in ("styles", "theme") and (r["kind"], r["target"]) not in o_wb_targets:
            if o_wb_counts.get(r["kind"], 0) == t_wb_counts.get(r["kind"], 0):
                continue
            dropped.append(f"workbook: missing {r['kind']} target {r['target']!r}")

    # Also verify archive-level customXml/* and vbaProject* parts were not stripped
    for member in sorted(tmpl_archive):
        low_name = PurePosixPath(member).name.lower()
        if (member.startswith("customXml/") or low_name.startswith("vbaproject")) and member not in out_archive:
            dropped.append(f"archive: dropped template non-worksheet part {member!r}")

    # 3. Per-template-sheet relationships (tables, drawings, comments, vmlDrawing, hyperlinks, etc.)
    sheet_ignored = frozenset({"printerSettings"})
    for sh, t_xml in tmpl_paths.items():
        if sh not in out_paths:
            continue
        o_xml = out_paths[sh]
        t_sh_rels, _ = _extract_part_relationships(ztmpl, t_xml, ignored_kinds=sheet_ignored)
        o_sh_rels, o_sh_dangling = _extract_part_relationships(zout, o_xml, ignored_kinds=sheet_ignored)
        for d_msg in o_sh_dangling:
            dropped.append(f"{sh}: {d_msg}")

        t_sh_counts: dict[str, int] = {}
        o_sh_counts: dict[str, int] = {}
        for r in t_sh_rels:
            t_sh_counts[r["kind"]] = t_sh_counts.get(r["kind"], 0) + 1
        for r in o_sh_rels:
            o_sh_counts[r["kind"]] = o_sh_counts.get(r["kind"], 0) + 1

        for kind, t_cnt in sorted(t_sh_counts.items()):
            o_cnt = o_sh_counts.get(kind, 0)
            if o_cnt < t_cnt:
                dropped.append(f"{sh}: dropped {kind} relationship(s) (template={t_cnt}, output={o_cnt})")

        # External hyperlink / target parity
        o_ext = {(r["kind"], r["target"]) for r in o_sh_rels if r["external"] == "true"}
        for r in t_sh_rels:
            if r["external"] == "true" and (r["kind"], r["target"]) not in o_ext:
                dropped.append(f"{sh}: dropped external {r['kind']} target {r['target']!r}")

        # Table identity preservation on template sheet
        t_tables = {
            _extract_table_identity(ztmpl, r["target"])
            for r in t_sh_rels
            if r["kind"] == "table" and r["external"] == "false"
        }
        o_tables = {
            _extract_table_identity(zout, r["target"])
            for r in o_sh_rels
            if r["kind"] == "table" and r["external"] == "false"
        }
        for missing_tbl in sorted(t_tables - o_tables):
            dropped.append(f"{sh}: dropped table {missing_tbl!r}")

        # Drawing child relationship preservation (charts, images, diagrams)
        t_draw_child_counts: dict[str, int] = {}
        for r in t_sh_rels:
            if r["kind"] == "drawing" and r["external"] == "false":
                c_rels, _ = _extract_part_relationships(ztmpl, r["target"], ignored_kinds=frozenset())
                for cr in c_rels:
                    t_draw_child_counts[cr["kind"]] = t_draw_child_counts.get(cr["kind"], 0) + 1

        o_draw_child_counts: dict[str, int] = {}
        for r in o_sh_rels:
            if r["kind"] == "drawing" and r["external"] == "false":
                c_rels, c_dangling = _extract_part_relationships(zout, r["target"], ignored_kinds=frozenset())
                for d_msg in c_dangling:
                    dropped.append(f"{sh}: {d_msg}")
                for cr in c_rels:
                    o_draw_child_counts[cr["kind"]] = o_draw_child_counts.get(cr["kind"], 0) + 1

        for c_kind, t_cnt in sorted(t_draw_child_counts.items()):
            o_cnt = o_draw_child_counts.get(c_kind, 0)
            if o_cnt < t_cnt:
                dropped.append(f"{sh}: dropped drawing {c_kind} target(s) (template={t_cnt}, output={o_cnt})")

    return dropped


def _extract_dv_rule_signature(el: ET.Element) -> tuple[Any, ...]:
    """Capture normalized constraint semantics of a SpreadsheetML ``<dataValidation>`` rule."""
    dv_type = (el.attrib.get("type") or "none").strip().lower()
    operator = (
        (el.attrib.get("operator") or "between").strip().lower() if dv_type not in ("none", "list", "custom") else ""
    )
    allow_blank = _xml_bool(el.attrib.get("allowBlank"), default=False)
    show_drop_down = _xml_bool(el.attrib.get("showDropDown"), default=False)
    show_input_msg = _xml_bool(el.attrib.get("showInputMessage"), default=False)
    show_error_msg = _xml_bool(el.attrib.get("showErrorMessage"), default=False)
    error_style = (el.attrib.get("errorStyle") or "stop").strip().lower()
    ime_mode = (el.attrib.get("imeMode") or "nocontrol").strip().lower()
    error_title = (el.attrib.get("errorTitle") or "").strip()
    error_body = (el.attrib.get("error") or "").strip()
    prompt_title = (el.attrib.get("promptTitle") or "").strip()
    prompt_body = (el.attrib.get("prompt") or "").strip()

    f1_raw = next(((ch.text or "") for ch in el if _local_name(ch.tag) == "formula1"), "")
    f2_raw = next(((ch.text or "") for ch in el if _local_name(ch.tag) == "formula2"), "")
    return (
        dv_type,
        operator,
        allow_blank,
        show_drop_down,
        show_input_msg,
        show_error_msg,
        error_style,
        ime_mode,
        error_title,
        error_body,
        prompt_title,
        prompt_body,
        _normalize_excel_expr(f1_raw),
        _normalize_excel_expr(f2_raw),
    )


def _extract_sheet_features(zf: zipfile.ZipFile, xml_path: str) -> dict[str, Any]:
    """Extract protection, merges, validations, CF, embedded part refs, and formula cells from a worksheet XML."""
    root = parse_safe_xml_bytes(read_safe_zip_bytes(zf, xml_path))

    protection: dict[str, str] | None = None
    merges: set[str] = set()
    dv_count = 0
    dv_sqrefs: set[str] = set()
    dv_rules_by_sqref: dict[str, list[tuple[Any, ...]]] = {}
    cf_blocks: dict[str, int] = {}
    shared_masters: dict[str, tuple[str, str]] = {}
    raw_formula_cells: list[tuple[str, ET.Element]] = []
    embedded_tags: dict[str, int] = {}

    for el in root.iter():
        lname = _local_name(el.tag)
        if lname == "sheetProtection":
            protection = dict(el.attrib)
        elif lname == "mergeCell":
            ref = el.attrib.get("ref", "").strip().upper()
            if ref:
                merges.add(ref)
        elif lname == "dataValidation":
            dv_count += 1
            sqref = el.attrib.get("sqref", "").strip().upper()
            dv_sig = _extract_dv_rule_signature(el)
            tokens = [tok for tok in sqref.split() if tok]
            if not tokens:
                dv_rules_by_sqref.setdefault("<EMPTY_SQREF>", []).append(dv_sig)
            for tok in tokens:
                dv_sqrefs.add(tok)
                dv_rules_by_sqref.setdefault(tok, []).append(dv_sig)
        elif lname == "conditionalFormatting":
            sqref = " ".join(el.attrib.get("sqref", "").strip().upper().split())
            rule_count = sum(1 for ch in el if _local_name(ch.tag) == "cfRule")
            cf_blocks[sqref] = cf_blocks.get(sqref, 0) + max(rule_count, 1)
        elif lname in ("drawing", "legacyDrawing", "tablePart"):
            embedded_tags[lname] = embedded_tags.get(lname, 0) + 1
        elif lname == "c":
            coord = el.attrib.get("r", "").strip().upper()
            f_el = next((ch for ch in el if _local_name(ch.tag) == "f"), None)
            if coord and f_el is not None:
                f_type = (f_el.attrib.get("t") or "normal").strip()
                si = f_el.attrib.get("si")
                f_txt = (f_el.text or "").strip()
                if f_type == "shared" and f_txt and si is not None:
                    shared_masters[si] = (coord, f_txt.lstrip("="))
                raw_formula_cells.append((coord, f_el))

    formula_cells: set[str] = set()
    formulas: dict[str, dict[str, Any]] = {}
    for coord, f_el in raw_formula_cells:
        f_type = (f_el.attrib.get("t") or "normal").strip()
        si = f_el.attrib.get("si")
        f_txt = (f_el.text or "").strip()

        resolved_expr: str | None = None
        if f_type == "shared":
            if f_txt:
                resolved_expr = _normalize_excel_expr(f_txt)
            elif si is not None and si in shared_masters:
                master_coord, master_body = shared_masters[si]
                try:
                    translated = Translator(f"={master_body}", origin=master_coord).translate_formula(coord)
                    resolved_expr = _normalize_excel_expr(translated)
                except Exception:
                    resolved_expr = f"<UNRESOLVED_SHARED:{si}>"
        elif f_txt:
            resolved_expr = _normalize_excel_expr(f_txt)

        if resolved_expr is not None:
            formula_cells.add(coord)
            calc_kind = "normal" if f_type.lower() in ("normal", "shared", "") else f_type.lower()
            target_ref = (f_el.attrib.get("ref") or "").strip().upper() if calc_kind in ("array", "datatable") else ""
            f_attrs = (
                calc_kind,
                target_ref,
                _xml_bool(f_el.attrib.get("ca"), default=False),
                _xml_bool(f_el.attrib.get("aca"), default=False),
                _xml_bool(f_el.attrib.get("dt2D"), default=False),
                _xml_bool(f_el.attrib.get("dtr"), default=False),
                _xml_bool(f_el.attrib.get("del1"), default=False),
                _xml_bool(f_el.attrib.get("del2"), default=False),
                (f_el.attrib.get("r1") or "").strip().upper(),
                (f_el.attrib.get("r2") or "").strip().upper(),
                _xml_bool(f_el.attrib.get("bx"), default=False),
            )
            formulas[coord] = {"expr": resolved_expr, "attrs": f_attrs}

    return {
        "protection": protection,
        "merges": merges,
        "dv_count": dv_count,
        "dv_sqrefs": dv_sqrefs,
        "dv_rules_by_sqref": dv_rules_by_sqref,
        "cf_blocks": cf_blocks,
        "embedded_tags": embedded_tags,
        "formula_cells": formula_cells,
        "formulas": formulas,
    }


_SHEET_PROTECTION_BOOL_ATTRS: frozenset[str] = frozenset(
    {"sheet", "objects", "scenarios", *_PROTECTION_LOCK_DEFAULT_TRUE_ATTRS}
)


def _check_protection_regression(
    sheet_name: str,
    tmpl_prot: dict[str, str] | None,
    out_prot: dict[str, str] | None,
) -> list[str]:
    if tmpl_prot is None:
        return []
    regressions: list[str] = []
    tmpl_sheet_on = _xml_bool(tmpl_prot.get("sheet"), default=False)
    if out_prot is None:
        if tmpl_sheet_on or tmpl_prot:
            regressions.append(f"{sheet_name}: <sheetProtection> element was removed")
        return regressions

    out_sheet_on = _xml_bool(out_prot.get("sheet"), default=False)
    if tmpl_sheet_on and not out_sheet_on:
        regressions.append(f"{sheet_name}: sheetProtection sheet='1' was disabled")

    for flag in ("objects", "scenarios"):
        if _xml_bool(tmpl_prot.get(flag), default=False) and not _xml_bool(out_prot.get(flag), default=False):
            regressions.append(f"{sheet_name}: sheetProtection {flag} protection was disabled")

    # In SpreadsheetML, formatCells/insertRows/etc. = '1' (default) means LOCKED/DISALLOWED; '0' means ALLOWED.
    for attr in _PROTECTION_LOCK_DEFAULT_TRUE_ATTRS:
        tmpl_locked = _xml_bool(tmpl_prot.get(attr), default=True)
        out_locked = _xml_bool(out_prot.get(attr), default=True)
        if tmpl_locked and not out_locked:
            regressions.append(f"{sheet_name}: sheetProtection restriction {attr} was weakened from locked to unlocked")

    stripped_verifier = False
    altered_verifier = False
    for attr_key, tmpl_val in tmpl_prot.items():
        if attr_key in _SHEET_PROTECTION_BOOL_ATTRS or not tmpl_val:
            continue
        out_val = out_prot.get(attr_key)
        if not out_val:
            stripped_verifier = True
        elif out_val != tmpl_val:
            altered_verifier = True
    if stripped_verifier:
        regressions.append(f"{sheet_name}: sheetProtection verifier attributes were stripped")
    if altered_verifier:
        regressions.append(f"{sheet_name}: sheetProtection verifier attributes were altered")

    return regressions


def compare_template_preservation(
    template_xlsx: Path,
    output_xlsx: Path,
    *,
    allow_added_sheets: bool = True,
) -> dict[str, Any]:
    """Compare ``output_xlsx`` against ``template_xlsx`` to guarantee zero destructive loss on template tabs."""
    with open_validated_zip(template_xlsx) as ztmpl, open_validated_zip(output_xlsx) as zout:
        tmpl_paths = resolve_sheet_xml_paths(ztmpl)
        out_paths = resolve_sheet_xml_paths(zout)
        tmpl_sheet_meta, tmpl_wb_prot = _extract_workbook_metadata(ztmpl)
        out_sheet_meta, out_wb_prot = _extract_workbook_metadata(zout)

        template_sheets = list(tmpl_paths.keys())
        output_sheets = list(out_paths.keys())

        missing_sheets = [s for s in template_sheets if s not in out_paths]
        added_sheets = [s for s in output_sheets if s not in tmpl_paths]
        surviving_in_output_order = [s for s in output_sheets if s in tmpl_paths]
        order_preserved = surviving_in_output_order == [s for s in template_sheets if s in out_paths]
        unexpected_added_sheets = [] if allow_added_sheets else list(added_sheets)

        sheet_metadata_regressions: list[str] = []
        protection_regressions: list[str] = _check_workbook_protection_regression(tmpl_wb_prot, out_wb_prot)
        lost_merged_cells: dict[str, list[str]] = {}
        lost_data_validations: dict[str, dict[str, Any]] = {}
        lost_conditional_formatting: dict[str, list[str]] = {}
        lost_formula_cells: dict[str, list[str]] = {}
        altered_formula_cells: dict[str, list[str]] = {}
        dropped_relationships: list[str] = _compare_non_worksheet_relationships(ztmpl, zout, tmpl_paths, out_paths)

        for sh in template_sheets:
            if sh not in out_paths:
                continue
            t_meta = tmpl_sheet_meta.get(sh, {})
            o_meta = out_sheet_meta.get(sh, {})
            if t_meta.get("sheetId") != o_meta.get("sheetId"):
                sheet_metadata_regressions.append(
                    f"{sh}: worksheet sheetId changed from {t_meta.get('sheetId')!r} to {o_meta.get('sheetId')!r}"
                )
            if t_meta.get("state") != o_meta.get("state"):
                sheet_metadata_regressions.append(
                    f"{sh}: worksheet visibility state changed from {t_meta.get('state')!r} to {o_meta.get('state')!r}"
                )

            t_feat = _extract_sheet_features(ztmpl, tmpl_paths[sh])
            o_feat = _extract_sheet_features(zout, out_paths[sh])

            prot_issues = _check_protection_regression(sh, t_feat["protection"], o_feat["protection"])
            protection_regressions.extend(prot_issues)

            dropped_merges = sorted(t_feat["merges"] - o_feat["merges"])
            if dropped_merges:
                lost_merged_cells[sh] = dropped_merges

            dropped_sqrefs = sorted(t_feat["dv_sqrefs"] - o_feat["dv_sqrefs"])
            altered_dv_sqrefs: list[str] = []
            for sqref_tok, t_sigs in sorted(t_feat["dv_rules_by_sqref"].items()):
                if sqref_tok not in o_feat["dv_rules_by_sqref"]:
                    continue
                t_counts = Counter(t_sigs)
                o_counts = Counter(o_feat["dv_rules_by_sqref"][sqref_tok])
                if any(o_counts[sig] < req_cnt for sig, req_cnt in t_counts.items()):
                    altered_dv_sqrefs.append(sqref_tok)

            if dropped_sqrefs or altered_dv_sqrefs or o_feat["dv_count"] < t_feat["dv_count"]:
                lost_data_validations[sh] = {
                    "template_count": t_feat["dv_count"],
                    "output_count": o_feat["dv_count"],
                    "dropped_sqrefs": dropped_sqrefs,
                    "altered_sqrefs": altered_dv_sqrefs,
                }

            cf_losses: list[str] = []
            for sqref, t_rules in t_feat["cf_blocks"].items():
                o_rules = o_feat["cf_blocks"].get(sqref, 0)
                if o_rules < t_rules:
                    cf_losses.append(f"sqref={sqref!r} (template_rules={t_rules}, output_rules={o_rules})")
            if cf_losses:
                lost_conditional_formatting[sh] = cf_losses

            for emb_tag, t_emb_cnt in sorted(t_feat["embedded_tags"].items()):
                o_emb_cnt = o_feat["embedded_tags"].get(emb_tag, 0)
                if o_emb_cnt < t_emb_cnt:
                    msg = f"{sh}: dropped worksheet <{emb_tag}> element(s) (template={t_emb_cnt}, output={o_emb_cnt})"
                    if msg not in dropped_relationships:
                        dropped_relationships.append(msg)

            dropped_formulas = sorted(t_feat["formula_cells"] - o_feat["formula_cells"])
            if dropped_formulas:
                lost_formula_cells[sh] = dropped_formulas

            changed_formulas: list[str] = []
            for coord in sorted(t_feat["formula_cells"] & o_feat["formula_cells"]):
                t_f = t_feat["formulas"][coord]
                o_f = o_feat["formulas"][coord]
                if t_f["expr"] != o_f["expr"]:
                    changed_formulas.append(f"{coord} (template='={t_f['expr']}', output='={o_f['expr']}')")
                elif t_f["attrs"] != o_f["attrs"]:
                    changed_formulas.append(f"{coord} (formula <f> attributes altered)")
            if changed_formulas:
                altered_formula_cells[sh] = changed_formulas

        tmpl_names = _extract_workbook_defined_names(ztmpl, template_sheets)
        out_names = _extract_workbook_defined_names(zout, output_sheets)
        lost_defined_names = sorted(
            f"{scope}:{name}" if scope != "*GLOBAL*" else name
            for (name, scope) in tmpl_names
            if (name, scope) not in out_names
        )
        altered_defined_names: list[str] = []
        for (name, scope), t_dn in sorted(tmpl_names.items()):
            if (name, scope) not in out_names:
                continue
            o_dn = out_names[(name, scope)]
            dn_label = f"{scope}:{name}" if scope != "*GLOBAL*" else name
            if t_dn["expr"] != o_dn["expr"]:
                altered_defined_names.append(f"{dn_label} (template={t_dn['raw']!r}, output={o_dn['raw']!r})")
            elif t_dn["hidden"] and not o_dn["hidden"]:
                altered_defined_names.append(f"{dn_label} (hidden='1' was disabled)")

    issues: list[str] = []
    if missing_sheets:
        issues.append(f"Missing original template sheet(s): {missing_sheets}")
    if not order_preserved:
        issues.append(f"Original template sheet order altered: expected {template_sheets}, got {output_sheets}")
    if unexpected_added_sheets:
        issues.append(f"Added sheets disallowed by flag: {unexpected_added_sheets}")
    if sheet_metadata_regressions:
        issues.extend(sheet_metadata_regressions)
    if protection_regressions:
        issues.extend(protection_regressions)
    if lost_merged_cells:
        issues.append(f"Dropped merged cell ranges on template sheets: {lost_merged_cells}")
    if lost_data_validations:
        issues.append(f"Dropped or altered data validations on template sheets: {lost_data_validations}")
    if lost_conditional_formatting:
        issues.append(f"Dropped conditional formatting on template sheets: {lost_conditional_formatting}")
    if lost_defined_names:
        issues.append(f"Dropped workbook definedNames: {lost_defined_names}")
    if altered_defined_names:
        issues.append(f"Altered workbook definedNames: {altered_defined_names}")
    if dropped_relationships:
        issues.append(f"Dropped non-worksheet relationship targets/parts: {dropped_relationships}")
    if lost_formula_cells:
        issues.append(f"Deleted or literal-overwritten template formula cells: {lost_formula_cells}")
    if altered_formula_cells:
        issues.append(f"Altered template formula cells: {altered_formula_cells}")

    return {
        "preserved": len(issues) == 0,
        "template_sheets": template_sheets,
        "output_sheets": output_sheets,
        "added_sheets": added_sheets,
        "missing_sheets": missing_sheets,
        "order_preserved": order_preserved,
        "unexpected_added_sheets": unexpected_added_sheets,
        "sheet_metadata_regressions": sheet_metadata_regressions,
        "protection_regressions": protection_regressions,
        "lost_merged_cells": lost_merged_cells,
        "lost_data_validations": lost_data_validations,
        "lost_conditional_formatting": lost_conditional_formatting,
        "lost_defined_names": lost_defined_names,
        "altered_defined_names": altered_defined_names,
        "dropped_relationships": dropped_relationships,
        "lost_formula_cells": lost_formula_cells,
        "altered_formula_cells": altered_formula_cells,
        "issues": issues,
    }


# ============================================================================
# CLI Interface
# ============================================================================


def _load_permutations_arg(raw_arg: str | None) -> dict[str, list[Any]] | None:
    if not raw_arg:
        return None
    stripped = raw_arg.strip()
    if stripped.startswith("{"):
        payload = json.loads(stripped)
    else:
        perm_path = Path(stripped)
        if perm_path.is_symlink():
            raise ContainmentError(f"Refusing symlink permutations JSON: {perm_path}")
        payload = json.loads(perm_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("--permutations-json must decode to a JSON object mapping 'Sheet!Cell' -> [values]")
    return payload


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="xlsx_ast_cache.py",
        description=(
            "Evaluate a deterministic subset of Excel formulas via AST, inject typed OOXML <v> caches "
            "using workbook.xml.rels sheet resolution, enforce <=255-char headers/footers, and verify "
            "customer template feature preservation (e.g., pricing schedules in swedencentral)."
        ),
    )
    parser.add_argument(
        "xlsx",
        nargs="?",
        type=Path,
        default=None,
        help="Path to the .xlsx workbook to inject or verify (or pass --workbook).",
    )
    parser.add_argument(
        "--workbook",
        dest="workbook_flag",
        type=Path,
        default=None,
        help="Path to the .xlsx workbook to inject or verify (alias for positional xlsx).",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Optional output .xlsx path (defaults to updating the input workbook in place unless --check-only).",
    )
    parser.add_argument(
        "--check-only",
        "--verify",
        dest="check_only",
        action="store_true",
        help="Verify existing <v> caches, formulas, and <=255-char headers/footers without modifying the workbook.",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=None,
        help="Optional JSON report path to write evaluation and template-preservation diagnostics.",
    )
    parser.add_argument(
        "--truncate-long-footers",
        action="store_true",
        help="Explicitly truncate >255-character worksheet headers/footers instead of failing closed.",
    )
    parser.add_argument(
        "--compare-template",
        type=Path,
        default=None,
        metavar="ORIG_XLSX",
        help="Verify non-destructive preservation of sheets, protection, merges, validations, CF, and definedNames.",
    )
    parser.add_argument(
        "--disallow-added-sheets",
        action="store_true",
        help="When used with --compare-template, fail if any supplemental tabs were added to the workbook.",
    )
    parser.add_argument(
        "--permutations-json",
        type=str,
        default=None,
        metavar="JSON_OR_FILE",
        help="Inline JSON object or JSON file mapping 'Sheet!Cell' -> [val1, val2] for formula permutation testing.",
    )
    parser.add_argument(
        "--verify-with-soffice",
        action="store_true",
        help="Cross-check numeric cells via headless LibreOffice (soffice) if installed on PATH.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable JSON summary to stdout.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    workbook_path: Path | None = args.workbook_flag or args.xlsx
    if workbook_path is None:
        parser.error("Provide either positional 'xlsx' or '--workbook <path>'.")

    try:
        permutations = _load_permutations_arg(args.permutations_json)
        if args.check_only:
            report = verify_workbook_caches(
                workbook_path,
                verify_with_soffice=args.verify_with_soffice,
                permutations=permutations,
            )
        else:
            report = inject_and_verify_caches(
                workbook_path,
                output_path=args.output,
                truncate_long_footers=args.truncate_long_footers,
                verify_with_soffice=args.verify_with_soffice,
                permutations=permutations,
            )

        target_xlsx = args.output if (args.output is not None and not args.check_only) else workbook_path
        if args.compare_template is not None:
            diff = compare_template_preservation(
                args.compare_template,
                target_xlsx,
                allow_added_sheets=not args.disallow_added_sheets,
            )
            report["template_preservation"] = diff
            if args.report is not None:
                if args.report.exists() and args.report.is_symlink():
                    raise ContainmentError(f"Refusing to overwrite symlink report path: {args.report}")
                args.report.parent.mkdir(parents=True, exist_ok=True)
                args.report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            if not diff["preserved"]:
                if args.json:
                    print(json.dumps(report, indent=2, sort_keys=True))
                else:
                    for issue in diff["issues"]:
                        print(f"[ERROR] Template preservation failure: {issue}", file=sys.stderr)
                return 1

        if args.report is not None:
            if args.report.exists() and args.report.is_symlink():
                raise ContainmentError(f"Refusing to overwrite symlink report path: {args.report}")
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")

        if args.json:
            print(json.dumps(report, indent=2, sort_keys=True))
        else:
            mode_lbl = "Verified" if args.check_only else "Injected & verified"
            print(
                f"[OK] {mode_lbl} {report['formulas_evaluated']} formulas across "
                f"{len(report['sheets'])} sheet(s) in {report['workbook']} "
                f"(authoritative_engine_checked={report['authoritative_engine_checked']})."
            )
        return 0
    except (
        ContainmentError,
        UnsupportedFormulaError,
        CircularFormulaError,
        FormulaEvaluationError,
        HeaderFooterLimitError,
        CacheParityError,
        TemplatePreservationError,
        FileNotFoundError,
        ValueError,
    ) as exc:
        if args.json:
            print(json.dumps({"status": "error", "error_type": type(exc).__name__, "message": str(exc)}, indent=2))
        else:
            print(f"[ERROR] {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
