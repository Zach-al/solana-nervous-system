fn main() {
    // Embed build metadata into the binary for anti-tamper identification.
    // These values are baked in at compile time and cannot be modified post-build
    // without breaking the binary's internal consistency checks.

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("system clock is before UNIX epoch")
        .as_secs();

    println!("cargo:rustc-env=BUILD_TIMESTAMP={}", timestamp);

    // Generate a unique build ID per compilation
    println!(
        "cargo:rustc-env=BUILD_ID={}",
        uuid::Uuid::new_v4()
    );

    // Embed git commit hash for traceability
    let git_hash = std::process::Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    println!("cargo:rustc-env=GIT_HASH={}", git_hash);

    // Re-run if HEAD changes (e.g., new commit)
    println!("cargo:rerun-if-changed=.git/HEAD");
    println!("cargo:rerun-if-changed=.git/refs/heads");
}
