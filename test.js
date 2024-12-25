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

// Test script 4 - simulates a database startup
const test4 = () => {
  console.log("Database starting...");
  setTimeout(() => {
    console.log("Database ready!");
    setInterval(() => {
      console.log("Database: Processing queries...");
    }, 2000);
  }, 3000);
};

// Test script 5 - simulates an API server that depends on database
const test5 = () => {
  console.log("API server starting...");
  setTimeout(() => {
    console.log("API server ready on port 3000!");
    setInterval(() => {
      console.log("API: Processing requests...");
    }, 1500);
  }, 2000);
};

// Test script 6 - simulates a frontend that depends on API
const test6 = () => {
  console.log("Frontend starting...");
  setTimeout(() => {
    console.log("Frontend dev server ready!");
    setInterval(() => {
      console.log("Frontend: Compiling changes...");
    }, 3000);
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
  case "test4":
    test4();
    break;
  case "test5":
    test5();
    break;
  case "test6":
    test6();
    break;
  default:
    console.error("Please specify test1-6");
    process.exit(1);
}
