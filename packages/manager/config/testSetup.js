// Configure Enzyme Adapter
var Enzyme = require('enzyme');
var Adapter = require('enzyme-adapter-react-16');

require('@testing-library/jest-dom/extend-expect');

Enzyme.configure({ adapter: new Adapter() });

/** LocalStorage mocks **/
const localStorageMock = (function() {
  // eslint-disable-line wrap-iife
  let store = {};
  return {
    getItem: function(key) {
      return store[key];
    },
    setItem: function(key, value) {
      store[key] = value.toString();
    },
    clear: function() {
      store = {};
    },
    removeItem: function(key) {
      delete store[key];
    }
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

HTMLCanvasElement.prototype.getContext = () => {
  return 0;
};

// IMPORTANT
// Below is a temporary hack to suppress warnings generated by a React bug.
// Source: https://github.com/testing-library/react-testing-library/issues/281
// @todo: remove this when React 16.9.0 is stable and we upgrade.
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (/Warning.*not wrapped in act/.test(args[0])) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
