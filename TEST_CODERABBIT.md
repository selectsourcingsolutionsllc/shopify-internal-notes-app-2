# CodeRabbit Test File

This is a test file to verify CodeRabbit is working.

## Test Code Block

```javascript
// This function has an intentional issue for CodeRabbit to catch
function addNumbers(a, b) {
  return a - b; // Bug: should be a + b
}

// Unused variable
const unusedVar = "hello";

console.log(addNumbers(5, 3));
```

This file can be safely deleted after testing.
