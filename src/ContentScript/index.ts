import { browser } from "webextension-polyfill-ts";

import { ReactController } from "./ReactController";

import {
  sendHandshake,
  acceptHandshake,
  encrypt,
  decrypt,
  finalizeHandshake,
} from "./crypto";

// TODO: move
const GLOBAL_PREFIX = "crypto//";
const GLOBAL_SUFFIX = "//crypto-end";
const HANDSHAKE_INIT_PREFIX = "crypto-init//";
const HANDSHAKE_ACCEPT_PREFIX = "crypto-accept//";
const tabId = window.location.hostname;
let ACTIVE = false;

const reactHandler = new ReactController();

// const times: number[] = [];
// const appendTime = (time: number) => {
//   times.push(time);
//   const sum = times.reduce((a, b) => {
//     return a + b;
//   }, 0);
//   const avg = sum / times.length || 0;

//   console.log(`${times.length}\nAVG: ${avg}\nTOTAL: ${sum / 1000} seconds`);
// };

const findAndReplaceNodes = async <T extends readonly string[]>(
  node: HTMLElement,
  prefixText: T[number],
  fn: (text: string) => Promise<void | string>,
  replaceText?: string
) => {
  const text = node.textContent;

  if (text?.includes(prefixText)) {
    const html = node.innerHTML;
    const startIndex = html.indexOf(prefixText);
    const endIndex = html.indexOf(GLOBAL_SUFFIX);
    const preString = html.slice(0, startIndex);
    const match = html.slice(startIndex + prefixText.length, endIndex);
    const postString = html.slice(endIndex + GLOBAL_SUFFIX.length);

    if (replaceText) {
      node.innerHTML = preString + replaceText + postString;
    }

    const result = await fn(match);

    if (result) {
      node.innerHTML = preString + result + postString;
    }
  }
};

const WATCHED_PREFIXES = [
  HANDSHAKE_INIT_PREFIX,
  HANDSHAKE_ACCEPT_PREFIX,
  GLOBAL_PREFIX,
] as const;
type WATCHED_PREFIXES = typeof WATCHED_PREFIXES;

const getContainsXpath = (...strings: string[]): string => {
  const body = strings.map((text) => `contains(text(), '${text}')`);

  return `..//*[${body.join(" or ")}]`;
};

const watch = (parentNode: Node) => {
  const isMatch = WATCHED_PREFIXES.some((prefix) =>
    parentNode.textContent?.includes(prefix)
  );
  if (isMatch) {
    const xpath = getContainsXpath(...WATCHED_PREFIXES);
    const evalResult = document.evaluate(
      xpath,
      parentNode,
      null,
      XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
      null
    );

    // snapshot
    for (let i = 0; i < evalResult.snapshotLength; i++) {
      const node = evalResult.snapshotItem(i) as HTMLElement;

      if (node) {
        // decipher messages
        findAndReplaceNodes<WATCHED_PREFIXES>(
          node,
          GLOBAL_PREFIX,
          async (text) => {
            const msg = await decipherMessage(text);

            return msg;
          }
        );

        // watch for init
        findAndReplaceNodes<WATCHED_PREFIXES>(
          node,
          HANDSHAKE_INIT_PREFIX,
          async (handshake) => {
            const [conversationId] = handshake.split(":");

            // save private key
            const storage = await browser.storage.sync.get(tabId);
            const tabSecrets: { [key: string]: string } | undefined =
              storage[tabId];

            if (!tabSecrets?.[conversationId]) {
              reactHandler.openInput(async (value) => {
                const { secret, handshakeResponse } = await acceptHandshake(
                  handshake
                );

                await browser.storage.sync.set({
                  [tabId]: {
                    ...tabSecrets,
                    [conversationId]: {
                      alias: value,
                      secret,
                    },
                  },
                });

                // send back public key
                await navigator.clipboard.writeText(
                  HANDSHAKE_ACCEPT_PREFIX + handshakeResponse + GLOBAL_SUFFIX
                );
                init();
                alert(
                  "Public key copied to clipboard! Paste and submit it in the conversation to complete the handshake. To encrypt your messages select text, right click and choose Cryptify -> Cryptify 🔒"
                );
              }, "inbound");
            }
          },
          "👋"
        );

        // decipher messages
        findAndReplaceNodes<WATCHED_PREFIXES>(
          node,
          HANDSHAKE_ACCEPT_PREFIX,
          async (handshakeResponse) => {
            const [conversationId] = handshakeResponse.split(":");

            const storage = await browser.storage.sync.get(tabId);
            const tabSecrets:
              | {
                  [key: string]: {
                    alias: string;
                    privateKey?: string;
                    secret?: string;
                  };
                }
              | undefined = storage[tabId];

            const privateKey = tabSecrets?.[conversationId]?.privateKey;
            // if privateKey exists compute a secret
            if (privateKey) {
              const { secret } = await finalizeHandshake(
                handshakeResponse,
                privateKey
              );
              await browser.storage.sync.set({
                [tabId]: {
                  ...tabSecrets,
                  [conversationId]: {
                    alias: tabSecrets?.[conversationId].alias,
                    secret,
                  },
                },
              });

              // when succesfully computed, refresh nodes
              // TODO: optimize this to only look for messages to decrypt
              init();
              alert(
                "Success! Your partner accepted the handshake. To encrypt your messages select text, right click and choose Cryptify -> Cryptify 🔒"
              );
            }
          },
          "🤝"
        );
      }
    }
  }
};

const observer = new MutationObserver((mutations) => {
  // const t0 = performance.now();
  mutations.forEach(async (mutation) => {
    mutation.addedNodes.forEach(async (parentNode) => {
      watch(parentNode);
    });
  });
  // const t1 = performance.now();
  // appendTime(t1 - t0);
});

const init = async () => {
  // watch
  watch(document.body);

  if (ACTIVE) {
    return;
  }

  const data = await browser.storage.sync.get(tabId);

  if (Object.keys(data).length > 0) {
    console.log("Cryptify is now running on this website!");
    ACTIVE = true;
    observer.observe(document.body, {
      childList: true,
      characterData: false,
      subtree: true,
    });
  }
};

init();

browser.runtime.onMessage.addListener(async (msg) => {
  switch (msg.type) {
    case "start": {
      const inputElement = document.activeElement as HTMLElement;

      reactHandler.openInput(async (value) => {
        const { privateKey, handshake, conversationId } = await sendHandshake();

        const storage = await browser.storage.sync.get(msg.id);
        const tabSecrets: { [key: string]: string } | undefined =
          storage[msg.id];
        await browser.storage.sync.set({
          [msg.id]: {
            ...tabSecrets,
            [conversationId]: {
              alias: value,
              privateKey,
            },
          },
        });

        await navigator.clipboard.writeText(
          HANDSHAKE_INIT_PREFIX + handshake + GLOBAL_SUFFIX
        );
        if (inputElement.focus) {
          inputElement.focus();
        }
        document.execCommand("paste");
      }, "outbound");

      return;
      // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage
      // return Promise.resolve("testing response");
    }
    case "encrypt": {
      const selection = window.getSelection();
      const node = selection?.anchorNode;
      const text = selection?.toString();

      if (node && text) {
        const secrets = (await browser.storage.sync.get(msg.id))[msg.id];
        const aliases = Object.keys(secrets)
          .filter((id) => secrets[id].secret)
          .map((id) => ({
            alias: secrets[id].alias,
            id,
          }));

        reactHandler.openSelect(async (id) => {
          const encryptedMessage = await sendMessage(
            id,
            secrets[id].secret,
            text
          );
          // reselect the text
          const range = document.createRange();
          range.selectNodeContents(node);
          selection?.addRange(range);

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
        }, aliases);
      }

      return;
    }

    case "decrypt": {
      const selection = window.getSelection();
      const node = selection?.anchorNode as HTMLElement;
      const text = selection?.toString();

      if (node && text?.includes(GLOBAL_PREFIX)) {
        const html = node.innerHTML;
        const startIndex = html.indexOf(GLOBAL_PREFIX);
        const endIndex = html.indexOf(GLOBAL_SUFFIX);
        const preString = html.slice(0, startIndex);
        const match = html.slice(startIndex + GLOBAL_PREFIX.length, endIndex);
        const postString = html.slice(endIndex + GLOBAL_SUFFIX.length);

        const deciphered = await decipherMessage(match);

        if (deciphered) {
          node.innerHTML = preString + deciphered + postString;
        }
      }

      return;
    }

    default:
      return;
  }
});

export async function sendMessage(id: string, secret: string, text: string) {
  const encryptedMsg = await encrypt(text, secret);

  return GLOBAL_PREFIX + id + ":" + encryptedMsg + GLOBAL_SUFFIX;
}

export async function decipherMessage(cipherText: string) {
  const [conversationId, ...encrypted] = cipherText.split(":");
  // TODO: Check how costly is this operation, consider moving it outside the fn
  const store = await browser.storage.sync.get(tabId);
  const secret = store?.[tabId]?.[conversationId]?.secret;

  if (!secret) {
    return;
  }

  const decryptedMessage = await decrypt(encrypted.join(":"), secret);

  return decryptedMessage;
}

// Exampe usage:
// async function start() {
//   // browser.storage.sync.clear();
//   // p1 - initiator
//   const { privateKey, handshake } = await sendHandshake();
//   console.log("p1 sent a handshake:", { privateKey, handshake });

//   // p2 - receiver, first one to compute a secret
//   const { secret: secret2, handshakeResponse } = await acceptHandshake(
//     handshake
//   );

//   // compute secret for initiator
//   const { secret } = await finalizeHandshake(handshakeResponse, privateKey);

//   console.log("p1 secret", secret);
//   console.log("p2 secret", secret2);

//   const text = "Ala ma kota";
//   const encrypted = await encrypt(text, secret);
//   const decrypted = await decrypt(text, secret2);
//   console.log({ encrypted, decrypted });
// }
