import { browser } from "webextension-polyfill-ts";
import ReactDOM from "react-dom";
import { createElement } from "react";

import { Select } from "./Select";
import { Input } from "./Input";

import {
  sendHandshake,
  acceptHandshake,
  computeSecret,
  encrypt,
  decrypt,
  finalizeHandshake,
} from "./crypto";

// TODO: move
const GLOBAL_PREFIX = "crypto//";
const HANDSHAKE_INIT_PREFIX = "crypto-init//";
const HANDSHAKE_ACCEPT_PREFIX = "crypto-accept//";

const times: number[] = [];
const tabId = window.location.hostname;

// create root node for React injection
const rootNode = document.createElement("div");
rootNode.id = "root-cryptify";
document.body.appendChild(rootNode);

const appendTime = (time: number) => {
  times.push(time);
  const sum = times.reduce((a, b) => {
    return a + b;
  }, 0);
  const avg = sum / times.length || 0;

  console.log(`${times.length}\nAVG: ${avg}\nTOTAL: ${sum / 1000} seconds`);
};

const findAndReplaceNodes = <T extends readonly string[]>(
  node: Node,
  prefixText: T[number],
  fn: (text: string) => void,
  replaceText?: string
): void => {
  const text = node.textContent;

  if (text?.includes(prefixText)) {
    const index = text.indexOf(prefixText);
    // TODO: stitch back original text
    // const preString = text.slice(0, index);
    const [match, ...postString] = text.slice(index).split(" ");

    if (replaceText) {
      node.textContent = replaceText;
    }

    fn(match.slice(prefixText.length));
  }
};

const WATCHED_PREFIXES = [
  HANDSHAKE_INIT_PREFIX,
  HANDSHAKE_ACCEPT_PREFIX,
  GLOBAL_PREFIX,
] as const;
type WATCHED_PREFIXES = typeof WATCHED_PREFIXES;

const getContainsXpath = (...strings: string[]): string => {
  const body = strings.map(text => `contains(text(), '${text}')`);

  return `..//*[${body.join(" or ")}]`;
};

const watch = (parentNode: Node) => {
  const isMatch = WATCHED_PREFIXES.some(prefix =>
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
      const node = evalResult.snapshotItem(i);

      if (node) {
        // decipher messages
        findAndReplaceNodes<WATCHED_PREFIXES>(
          node,
          GLOBAL_PREFIX,
          async text => {
            const msg = await decipherMessage(tabId, text);
            if (msg) {
              node.textContent = msg;
            }
          }
        );

        // watch for init
        findAndReplaceNodes<WATCHED_PREFIXES>(
          node,
          HANDSHAKE_INIT_PREFIX,
          async handshake => {
            const [conversationId] = handshake.split(":");

            // save private key
            const storage = await browser.storage.sync.get(tabId);
            const tabSecrets: { [key: string]: string } | undefined =
              storage[tabId];

            if (!tabSecrets?.[conversationId]) {
              ReactDOM.render(
                createElement(Input, {
                  handleSubmit: async value => {
                    ReactDOM.unmountComponentAtNode(rootNode);

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
                      HANDSHAKE_ACCEPT_PREFIX + handshakeResponse
                    );
                    alert(
                      "Public key copied to clipboard! Paste it in the conversation"
                    );
                  },
                }),
                rootNode
              );
            }
          },
          "👋"
        );

        // decipher messages
        findAndReplaceNodes<WATCHED_PREFIXES>(
          node,
          HANDSHAKE_ACCEPT_PREFIX,
          async handshakeResponse => {
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

            debugger;

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
              watch(document.body);
            }
          },
          "🤝"
        );
      }
    }
  }
};

const observer = new MutationObserver(mutations => {
  const t0 = performance.now();
  mutations.forEach(async mutation => {
    mutation.addedNodes.forEach(async parentNode => {
      watch(parentNode);
    });
  });
  const t1 = performance.now();
  // appendTime(t1 - t0);
});

watch(document.body);
observer.observe(document.body, {
  childList: true,
  characterData: false,
  subtree: true,
});

browser.runtime.onMessage.addListener(async msg => {
  switch (msg.type) {
    case "start": {
      const inputElement = document.activeElement as HTMLElement;

      ReactDOM.render(
        createElement(Input, {
          handleSubmit: async value => {
            ReactDOM.unmountComponentAtNode(rootNode);
            const {
              privateKey,
              handshake,
              conversationId,
            } = await sendHandshake();

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
              HANDSHAKE_INIT_PREFIX + handshake
            );
            if (inputElement.focus) {
              inputElement.focus();
            }
            document.execCommand("paste");
          },
        }),
        rootNode
      );

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
        const aliases = Object.keys(secrets).map(id => ({
          alias: secrets[id].alias,
          id,
        }));

        ReactDOM.render(
          createElement(Select, {
            options: aliases,
            handleSelect: async id => {
              ReactDOM.unmountComponentAtNode(rootNode);
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
            },
          }),
          rootNode
        );
      }
      return;
    }

    case "decrypt": {
      const selection = window.getSelection();
      const node = selection?.anchorNode;
      const text = selection?.toString();

      if (node && text) {
        const deciphered = await decipherMessage(msg.id, text);
        if (deciphered) {
          node.textContent = deciphered;
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

  return GLOBAL_PREFIX + id + ":" + encryptedMsg;
}

export async function decipherMessage(tabId: string, cipherText: string) {
  const [conversationId, ...encrypted] = cipherText.split(":");
  // TODO: Check how costly is this operation, consider moving it outside the fn
  const store = await browser.storage.sync.get(tabId);
  const secret = store?.[tabId]?.[conversationId]?.secret;

  if (!secret) {
    return false;
  }

  const decryptedMessage = await decrypt(encrypted.join(":"), secret);

  return decryptedMessage;
}
