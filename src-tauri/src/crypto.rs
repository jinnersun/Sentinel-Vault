use ring::rand::{SecureRandom, SystemRandom};
use ring::pbkdf2;
use base64::{Engine as _, engine::general_purpose};
use std::num::NonZeroU32;

/// 生成随机盐值
pub fn generate_salt() -> [u8; 32] {
    let mut salt = [0u8; 32];
    SystemRandom::new().fill(&mut salt).unwrap();
    salt
}

pub fn hash_password(password: &str, salt: &[u8; 32]) -> String {
    let mut hash = [0u8; 32];
    pbkdf2::derive(
        pbkdf2::PBKDF2_HMAC_SHA256,
        NonZeroU32::new(100_000).unwrap(),
        salt,
        password.as_bytes(),
        &mut hash,
    );
    general_purpose::STANDARD.encode(hash)
}