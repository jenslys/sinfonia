// Test script 1 - prints numbers every second
const test1 = () => {
  let i = 0;
  setInterval(() => {
    console.log(`Counter: ${i++}`);
  }, 1000);
};

// Test script 2 - prints random numbers every 2 seconds
const test2 = () => {
  setInterval(() => {
    console.log(`Random: ${Math.random()}`);
  }, 2000);
};

// Test script 3 - prints timestamp every 1.5 seconds
const test3 = () => {
  setInterval(() => {
    console.log(`Time: ${new Date().toISOString()}`);
  }, 1500);
};

// Run the one specified by argument
const script = process.argv[2];
switch (script) {
  case "test1":
    test1();
    break;
  case "test2":
    test2();
    break;
  case "test3":
    test3();
    break;
  default:
    console.error("Please specify test1, test2, or test3");
    process.exit(1);
}
