const EC_VARIANT = "ECDH";
const NAMED_CURVE = "P-384";

function arrayBufferToString(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const binary = bytes.reduce(
    (acc, byte) => acc + String.fromCharCode(byte),
    ""
  );

  return binary;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const binary = arrayBufferToString(buffer);

  return window.btoa(binary);
}

function encodeIV(iv: Uint8Array) {
  const binary = iv.reduce((acc, byte) => acc + String.fromCharCode(byte), "");

  return window.btoa(binary);
}

function decodeIV(base64: string) {
  const str = window.atob(base64);
  const buf = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    buf[i] = str.charCodeAt(i);
  }

  return buf;
}

function stringToArrayBuffer(str: string): ArrayBuffer {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0; i < str.length; i++) {
    bufView[i] = str.charCodeAt(i);
  }

  return buf;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const str = window.atob(base64);

  return stringToArrayBuffer(str);
}

function getECKey(base64: string, format: "raw" | "pkcs8") {
  return crypto.subtle.importKey(
    format,
    base64ToArrayBuffer(base64),
    {
      name: EC_VARIANT,
      namedCurve: NAMED_CURVE,
    },
    false,
    format === "raw" ? [] : ["deriveKey"]
  );
}

function getSecretFromBase64(base64: string) {
  const buffer = base64ToArrayBuffer(base64);

  return crypto.subtle.importKey(
    "raw",
    buffer,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function computeSecret(
  privateKey: CryptoKey,
  publicKey: CryptoKey
) {
  const secretKey = await window.crypto.subtle.deriveKey(
    {
      name: EC_VARIANT,
      public: publicKey,
    },
    privateKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );

  const buffer = await window.crypto.subtle.exportKey("raw", secretKey);

  return arrayBufferToBase64(buffer);
}

// Generate p1's keys and return handshake pattern
export async function sendHandshake() {
  const p = await window.crypto.subtle.generateKey(
    {
      name: EC_VARIANT,
      namedCurve: NAMED_CURVE,
    },
    true,
    ["deriveKey"]
  );

  const publicKeyBuffer = await window.crypto.subtle.exportKey(
    "raw",
    p.publicKey
  );
  const privateKeyBuffer = await window.crypto.subtle.exportKey(
    "pkcs8",
    p.privateKey
  );
  const publicKey = arrayBufferToBase64(publicKeyBuffer);
  const privateKey = arrayBufferToBase64(privateKeyBuffer);

  console.log({ publicKey, privateKey });

  // use unix timestamp for conversation id
  const conversationId = new Date().valueOf();

  return {
    conversationId,
    handshake: conversationId + ":" + publicKey,
    publicKey,
    privateKey,
  };
}

function decodeHandshake(handshake: string) {
  const [conversationId, foreignKey] = handshake.split(":");

  return {
    conversationId,
    foreignKey,
  };
}

// Take handshake pattern and create own
export async function acceptHandshake(handshake: string) {
  const { conversationId, foreignKey } = decodeHandshake(handshake);

  const p = await window.crypto.subtle.generateKey(
    {
      name: EC_VARIANT,
      namedCurve: NAMED_CURVE,
    },
    false,
    ["deriveKey"]
  );

  const publicKeyBuffer = await window.crypto.subtle.exportKey(
    "raw",
    p.publicKey
  );
  const publicKey = arrayBufferToBase64(publicKeyBuffer);
  const foreignCryptoKey = await getECKey(foreignKey, "raw");

  const secret = await computeSecret(p.privateKey, foreignCryptoKey);

  return {
    publicKey,
    secret,
    conversationId,
    handshakeResponse: conversationId + ":" + publicKey,
  };
}

// Get handshake response and compute secret for OP
export async function finalizeHandshake(
  handshakeResponse: string,
  privateKey: string
) {
  const { conversationId, foreignKey } = decodeHandshake(handshakeResponse);
  const privateCryptoKey = await getECKey(privateKey, "pkcs8");
  const publicForeignKey = await getECKey(foreignKey, "raw");

  const secret = await computeSecret(privateCryptoKey, publicForeignKey);

  return {
    secret,
    conversationId,
  };
}

export async function encrypt(text: string, key: string) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = stringToArrayBuffer(text);
  const secret = await getSecretFromBase64(key);

  const dataBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    secret,
    encoded
  );

  return encodeIV(iv) + ":" + arrayBufferToBase64(dataBuffer);
}

export async function decrypt(text: string, key: string) {
  try {
    const [encodedIv, ciphertext] = text.split(":");
    const iv = decodeIV(encodedIv);
    const dataBuffer = base64ToArrayBuffer(ciphertext);
    const secret = await getSecretFromBase64(key);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      secret,
      dataBuffer
    );

    return arrayBufferToString(decryptedBuffer);
  } catch (e) {
    return text;
  }
}
