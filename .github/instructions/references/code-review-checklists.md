<!-- ref:code-review-checklists-v1 -->

# Code Review — Detailed Checklists and Examples

Detailed standards and examples for `code-quality.instructions.md`.
Prioritization, comment format, and security bullet list live in the instruction file.

## Code Quality Standards

When performing a code review, check for:

### Clean Code

- Descriptive and meaningful names for variables, functions, and classes
- Single Responsibility Principle: each function/class does one thing well
- DRY (Don't Repeat Yourself): no code duplication
- Functions should be small and focused (ideally < 20-30 lines)
- Avoid deeply nested code (max 3-4 levels)
- Avoid magic numbers and strings (use constants)
- Code should be self-documenting; comments only when necessary

### Clean Code Examples

```javascript
// BAD: Poor naming and magic numbers
function calc(x, y) {
  if (x > 100) return y * 0.15;
  return y * 0.1;
}

// GOOD: Clear naming and constants
const PREMIUM_THRESHOLD = 100;
const PREMIUM_DISCOUNT_RATE = 0.15;
const STANDARD_DISCOUNT_RATE = 0.1;

function calculateDiscount(orderTotal, itemPrice) {
  const isPremiumOrder = orderTotal > PREMIUM_THRESHOLD;
  const discountRate = isPremiumOrder
    ? PREMIUM_DISCOUNT_RATE
    : STANDARD_DISCOUNT_RATE;
  return itemPrice * discountRate;
}
```

### Error Handling

- Proper error handling at appropriate levels
- Meaningful error messages
- No silent failures or ignored exceptions
- Fail fast: validate inputs early
- Use appropriate error types/exceptions

### Error Handling Examples

```python
# BAD: Silent failure and generic error
def process_user(user_id):
    try:
        user = db.get(user_id)
        user.process()
    except:
        pass

# GOOD: Explicit error handling
def process_user(user_id):
    if not user_id or user_id <= 0:
        raise ValueError(f"Invalid user_id: {user_id}")

    try:
        user = db.get(user_id)
    except UserNotFoundError:
        raise UserNotFoundError(
            f"User {user_id} not found in database"
        )
    except DatabaseError as e:
        raise ProcessingError(
            f"Failed to retrieve user {user_id}: {e}"
        )

    return user.process()
```

## Security Review Examples

```javascript
// BAD: Exposed secret in code
const API_KEY = "sk_live_abc123xyz789";

// GOOD: Use environment variables
const API_KEY = process.env.API_KEY;
```

## Testing Standards

When performing a code review, verify test quality:

- **Coverage**: Critical paths and new functionality must have tests
- **Test Names**: Descriptive names that explain what is being tested
- **Test Structure**: Clear Arrange-Act-Assert or Given-When-Then
- **Independence**: Tests should not depend on each other
- **Assertions**: Use specific assertions, avoid generic assertTrue
- **Edge Cases**: Test boundary conditions, null values, empty collections
- **Mock Appropriately**: Mock external dependencies, not domain logic

### Testing Examples

```javascript
// GOOD: Descriptive name and specific assertion
test("should calculate 10% discount for orders under $100", () => {
  const orderTotal = 50;
  const itemPrice = 20;

  const discount = calculateDiscount(orderTotal, itemPrice);

  expect(discount).toBe(2.0);
});
```

## Performance Considerations

When performing a code review, check for performance issues:

- **Database Queries**: Avoid N+1 queries, use proper indexing
- **Algorithms**: Appropriate time/space complexity for the use case
- **Caching**: Utilize caching for expensive or repeated operations
- **Resource Management**: Proper cleanup of connections, files, streams
- **Pagination**: Large result sets should be paginated
- **Lazy Loading**: Load data only when needed

### Performance Examples

```python
# BAD: N+1 query problem
users = User.query.all()
for user in users:
    orders = Order.query.filter_by(user_id=user.id).all()

# GOOD: Use JOIN or eager loading
users = User.query.options(joinedload(User.orders)).all()
for user in users:
    orders = user.orders
```

## Architecture and Design

When performing a code review, verify architectural principles:

- **Separation of Concerns**: Clear boundaries between layers/modules
- **Dependency Direction**: High-level modules don't depend on low-level details
- **Interface Segregation**: Prefer small, focused interfaces
- **Loose Coupling**: Components should be independently testable
- **High Cohesion**: Related functionality grouped together
- **Consistent Patterns**: Follow established patterns in the codebase

## Documentation Standards

When performing a code review, check documentation:

- **API Documentation**: Public APIs must be documented
- **Complex Logic**: Non-obvious logic should have explanatory comments
- **README Updates**: Update README when adding features or changing setup
- **Breaking Changes**: Document any breaking changes clearly
- **Examples**: Provide usage examples for complex features

## Review Checklist

### Code Quality

- [ ] Code follows consistent style and conventions
- [ ] Names are descriptive and follow naming conventions
- [ ] Functions/methods are small and focused
- [ ] No code duplication
- [ ] Complex logic is broken into simpler parts
- [ ] Error handling is appropriate
- [ ] No commented-out code or TODO without tickets

### Security

- [ ] No sensitive data in code or logs
- [ ] Input validation on all user inputs
- [ ] No SQL injection vulnerabilities
- [ ] Authentication and authorization properly implemented
- [ ] Dependencies are up-to-date and secure

### Testing

- [ ] New code has appropriate test coverage
- [ ] Tests are well-named and focused
- [ ] Tests cover edge cases and error scenarios
- [ ] Tests are independent and deterministic
- [ ] No tests that always pass or are commented out

### Performance

- [ ] No obvious performance issues (N+1, memory leaks)
- [ ] Appropriate use of caching
- [ ] Efficient algorithms and data structures
- [ ] Proper resource cleanup

### Architecture

- [ ] Follows established patterns and conventions
- [ ] Proper separation of concerns
- [ ] No architectural violations
- [ ] Dependencies flow in correct direction

### Documentation

- [ ] Public APIs are documented
- [ ] Complex logic has explanatory comments
- [ ] README is updated if needed
- [ ] Breaking changes are documented
