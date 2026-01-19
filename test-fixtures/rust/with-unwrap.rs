// This file contains .unwrap() calls which should be flagged in library code

pub fn parse_number(s: &str) -> i32 {
    s.parse::<i32>().unwrap()  // Should be caught by no-unwrap-in-lib
}

pub fn get_first<T>(vec: Vec<T>) -> T {
    vec.into_iter().next().unwrap()  // Another unwrap to catch
}

fn main() {
    let result = parse_number("42");
    println!("{}", result);
}
