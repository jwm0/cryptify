import { browser } from "webextension-polyfill-ts";

import {
  sendHandshake,
  acceptHandshake,
  computeSecret,
  encrypt,
  decrypt
} from "./crypto";

const observer = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    // console.log("new mutation", mutation);
  });
});

observer.observe(document.body, {
  childList: true,
  characterData: true,
  subtree: true
});

browser.runtime.onMessage.addListener(async msg => {
  switch (msg.type) {
    case "start": {
      await start(msg.id);

      window.addEventListener(
        "keypress",
        e => {
          console.log("keypress", e);
        },
        { passive: true }
      );

      return;
      // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage
      return Promise.resolve("testing response");
    }
    case "encrypt":
      {
        const selection = window.getSelection();
        const node = selection?.anchorNode;
        const text = selection?.toString();

        if (node && text) {
          const encryptedMessage = await sendMessage(msg.id, text);
          try {
            // OPTIONAL FEATURE: Persist previous clipboard state
            // WARNING: This will trigger Permissions API and display dialog
            // const _clipboard = await navigator.clipboard.readText();
            // console.log(_clipboard);

            await navigator.clipboard.writeText(encryptedMessage);
            document.execCommand("paste");
            await navigator.clipboard.writeText(""); // clear clipboard
            // or restore
            // await navigator.clipboard.writeText(_clipboard);
          } catch (e) {
            console.warn("Clipboard API permission denied");
          }
        }
      }

      return;

    case "decrypt": {
      const selection = window.getSelection();
      const node = selection?.anchorNode;
      const text = selection?.toString();

      if (node && text) {
        node.textContent = await decipherMessage(msg.id, text);
      }
      return;
    }
    default:
      return;
  }
});

export async function start(tabId: string) {
  // p1 - initiator
  const { p1, handshake } = sendHandshake();
  console.log("handshake: ", handshake);

  // p2 - receiver, first one to compute a secret
  const p2Key = acceptHandshake(handshake);
  console.log("handshake response", p2Key);

  // compute secret for initiator
  const secret = computeSecret(p1, p2Key);
  await browser.storage.sync.set({ [tabId]: secret });
}

// TODO: move
const GLOBAL_PREFIX = "//crypto//:";

export async function sendMessage(tabId: string, text: string) {
  const secret = (await browser.storage.sync.get(tabId))[tabId];

  if (!secret) {
    return "SECRET NOT FOUND";
  }

  return GLOBAL_PREFIX + encrypt(text, secret);
}

export async function decipherMessage(tabId: string, cipherText: string) {
  const secret = (await browser.storage.sync.get(tabId))[tabId];
  const encrypted = cipherText.slice(GLOBAL_PREFIX.length);

  if (!secret) {
    return cipherText;
  }

  return decrypt(encrypted, secret);
}
