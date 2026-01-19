// This file contains dbg!() macro which should be flagged

fn calculate(x: i32, y: i32) -> i32 {
    let result = x + y;
    dbg!(result);  // This should be caught by no-dbg-macro rule
    result
}

fn main() {
    let value = 42;
    dbg!(value);  // Another dbg! to catch
}
