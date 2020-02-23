import { browser } from "webextension-polyfill-ts";

import {
  sendHandshake,
  acceptHandshake,
  computeSecret,
  encrypt,
  decrypt
} from "./crypto";

// TODO: move
const GLOBAL_PREFIX = "//crypto//:";

let times: number[] = [];

const appendTime = (time: number) => {
  times.push(time);
  const sum = times.reduce((a, b) => a + b, 0);
  const avg = sum / times.length || 0;

  console.log(`${times.length}\nAVG: ${avg}\nTOTAL: ${sum / 1000} seconds`);
};

const observer = new MutationObserver(mutations => {
  const tabId = location.href;

  const t0 = performance.now();
  mutations.forEach(async mutation => {
    mutation.addedNodes.forEach(async parentNode => {
      if (parentNode.textContent?.includes(GLOBAL_PREFIX)) {
        const xpath = `.//*[contains(text(), '${GLOBAL_PREFIX}')]`;
        const evalResult = document.evaluate(
          xpath,
          parentNode,
          null,
          XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
          null
        );

        // snapshot
        for (let i = 0; i < evalResult.snapshotLength; i++) {
          const node = evalResult.snapshotItem(i);
          if (node?.textContent?.includes(GLOBAL_PREFIX)) {
            const msg = await decipherMessage(tabId, node.textContent!);
            node.textContent = msg;
          } else {
            console.log("ALREADY SWAPPED!!", node);
          }
        }
      }
    });
  });
  const t1 = performance.now();
  appendTime(t1 - t0);
});

observer.observe(document.body, {
  childList: true,
  characterData: false,
  subtree: true
});

browser.runtime.onMessage.addListener(async msg => {
  switch (msg.type) {
    case "start": {
      await start(msg.id);

      // window.addEventListener(
      //   "keypress",
      //   e => {
      //     console.log("keypress", e);
      //   },
      //   { passive: true }
      // );

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
  const { tabId: storage } = await browser.storage.sync.get(tabId);
  if (storage) {
    const timestamp = new Date().valueOf();
    console.log(
      "Secret for this URL already exists, creating new one with timestamp: ",
      timestamp
    );
    await browser.storage.sync.set({ [`${tabId}-${timestamp}`]: secret });
  } else {
    await browser.storage.sync.set({ [tabId]: secret });
  }
}

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
