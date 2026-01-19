// This file contains multiple types of violations

pub fn process_data(input: Option<String>) -> String {
    let data = input.unwrap();  // no-unwrap-in-lib violation

    dbg!(&data);  // no-dbg-macro violation

    data.to_uppercase()
}

pub fn debug_value(x: i32) {
    dbg!(x);  // Another dbg! violation
    println!("Value: {}", x);
}
