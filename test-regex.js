const code = "999A521";
const pattern = /^[A-Z0-9]{7}$/;

console.log("Testing code:", code);
console.log("Pattern:", pattern);
console.log("Matches?", pattern.test(code));
console.log("Length:", code.length);
console.log("Characters:", code.split('').join(', '));
