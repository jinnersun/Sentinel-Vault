use ring::aead::{AES_256_GCM, LessSafeKey, Nonce, UnboundKey, Aad};
use ring::rand::{SecureRandom, SystemRandom};
use ring::{error::Unspecified, pbkdf2};
use base64::{Engine as _, engine::general_purpose};
use std::num::NonZeroU32;

pub struct CryptoManager {
    master_key: [u8; 32],
}

impl CryptoManager {
    pub fn new(password: &str, salt: &[u8; 32]) -> Self {
        let mut master_key = [0u8; 32];
        pbkdf2::derive(
            pbkdf2::PBKDF2_HMAC_SHA256,
            NonZeroU32::new(100_000).unwrap(),
            salt,
            password.as_bytes(),
            &mut master_key,
        );
        
        Self { master_key }
    }

    pub fn encrypt(&self, plaintext: &str) -> Result<String, Unspecified> {
        let rng = SystemRandom::new();
        let mut salt_bytes = [0u8; 12];
        rng.fill(&mut salt_bytes)?;
        
        let unbound_key = UnboundKey::new(&AES_256_GCM, &self.master_key)
            .map_err(|_| Unspecified)?;
        let sealing_key = LessSafeKey::new(unbound_key);
        
        let nonce_bytes = salt_bytes;
        let nonce = Nonce::assume_unique_for_key(nonce_bytes);
        
        let mut encrypted_data = plaintext.as_bytes().to_vec();
        sealing_key.seal_in_place_append_tag(nonce, Aad::empty(), &mut encrypted_data)
            .map_err(|_| Unspecified)?;
        
        let mut result = salt_bytes.to_vec();
        result.extend_from_slice(&encrypted_data);
        
        Ok(general_purpose::STANDARD.encode(result))
    }

    pub fn decrypt(&self, ciphertext: &str) -> Result<String, Unspecified> {
        let data = general_purpose::STANDARD.decode(ciphertext)
            .map_err(|_| Unspecified)?;
        
        if data.len() < 12 {
            return Err(Unspecified);
        }
        
        let (nonce_bytes, encrypted_data) = data.split_at(12);
        let nonce = Nonce::assume_unique_for_key(
            nonce_bytes.try_into().map_err(|_| Unspecified)?
        );
        
        let unbound_key = UnboundKey::new(&AES_256_GCM, &self.master_key)
            .map_err(|_| Unspecified)?;
        let sealing_key = LessSafeKey::new(unbound_key);
        
        let mut decrypted_data = encrypted_data.to_vec();
        let plaintext_len = sealing_key.open_in_place(nonce, Aad::empty(), &mut decrypted_data)
            .map_err(|_| Unspecified)?
            .len();
        
        let plaintext = String::from_utf8(decrypted_data[..plaintext_len].to_vec())
            .map_err(|_| Unspecified)?;
        
        Ok(plaintext)
    }
}

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