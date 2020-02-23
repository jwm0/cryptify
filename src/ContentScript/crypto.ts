import crypto from "crypto";

// TODO: USE WINDOW.CRYPTO instead (async)

// CONSTANTS
// const MESSAGE = process.argv[2];
const CIPHER = "aes256";
const ENCODING = "base64";

// p1 - initiator
// const { p1, handshake } = sendHandshake();
// console.log("handshake: ", handshake);

// // p2 - receiver, first one to compute a secret
// const p2Key = acceptHandshake(handshake);
// console.log("handshake response", p2Key);

// // compute secret for initiator
// const iv = crypto.randomBytes(16);
// const p1Secret = p1.computeSecret(p2Key, ENCODING);
// SECRET = crypto
//   .createHash("sha256")
//   .update(p1Secret)
//   .digest(ENCODING)
//   .substr(0, 32);

// console.log("SECRET: ", SECRET.toString(ENCODING));

// const encrypted = encrypt(MESSAGE, SECRET);
// console.log("encrypted message: ", encrypted);

// const originalText = decrypt(encrypted, SECRET);
// console.log("decrypted message: ", originalText);

// Generate random IV
export function generateIv() {
  const iv = crypto.randomBytes(16);

  return iv;
}

// Compute secret
export function computeSecret(p: crypto.DiffieHellman, foreignKey: string) {
  const pSecret = p.computeSecret(foreignKey, ENCODING);
  const secret = crypto
    .createHash("sha256")
    .update(pSecret)
    .digest(ENCODING)
    .substr(0, 32);

  return secret;
}

// Generate p1's keys and return handshake pattern
export function sendHandshake() {
  const p1 = crypto.createDiffieHellman(128);
  const p1Key = p1.generateKeys();

  return {
    handshake:
      p1.getPrime(ENCODING) +
      ":" +
      p1.getGenerator(ENCODING) +
      ":" +
      p1Key.toString(ENCODING),
    p1
  };
}

// Take handshake pattern and create own
export function acceptHandshake(handshake: string) {
  const [prime, generator, key] = handshake.split(":");
  const p2 = crypto.createDiffieHellman(prime, ENCODING, generator, ENCODING);
  const p2Key = p2.generateKeys();
  // <---SECRET--->
  const secret = computeSecret(p2, key);

  return p2Key.toString(ENCODING);
}

export function encrypt(text: string, key: string) {
  const iv = generateIv();
  let cipher = crypto.createCipheriv(CIPHER, key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString(ENCODING) + ":" + encrypted.toString(ENCODING);
}

export function decrypt(text: string, key: string) {
  try {
    const ciphertext = text.split(":");
    let iv = Buffer.from(ciphertext[0], ENCODING);
    let encryptedText = Buffer.from(ciphertext[1], ENCODING);
    let decipher = crypto.createDecipheriv(CIPHER, key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    return text;
  }
}
