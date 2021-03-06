



## Function exists:  

```js
test("Function getColor should exist", function(){
  const file = rewire("./app.js");
  const getColor = file.__get__('getColor');
  expect(getColor).toBeTruthy();
});

```

## Function returns something:  

```js
test("Function getColor should return something", function(){
  const file = rewire("./app.js");
  const getColor = file.__get__('getColor');
  expect(getColor()).toBeTruthy();
});

```

## How many times a function is called

```js
// mock the function
let _buffer = "";
global.console.log = console.log = jest.fn((text) => _buffer += text + "\n");

it('console.log() function should have been called 2 times', function () {
    //then I import the index.js (which should have the alert() call inside)
    const file = require("./app.js");
    expect(console.log.mock.calls.length).toBe(2);
});
```

## A particular string has been printed on the console
```js
it('Print the 1st item on the array (position 2)', function () {
    //You can also compare the entire console buffer (if there have been several console.log calls on the exercise)
    expect(_buffer.includes("4\n")).toBe(true);
});
```

## That a function has been called with specific parameter

```js
it('Call the function with Hello world', function () {
  expect(console.log).toHaveBeenCalledWith("Hello World");
 });
```

