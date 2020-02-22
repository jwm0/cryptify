import { browser } from "webextension-polyfill-ts";

browser.runtime.onInstalled.addListener((): void => {
  console.log("extension installed");
});

browser.contextMenus.create({
  id: "cryptify-start",
  title: "Start secret conversation",
  contexts: ["all"]
});

browser.contextMenus.create({
  id: "encrypt",
  title: "Cryptify 🔒",
  contexts: ["all"]
});

browser.contextMenus.create({
  id: "decrypt",
  title: "Decryptify 🔓",
  contexts: ["all"]
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case "cryptify-start":
      console.log("START");
      browser.tabs.sendMessage(tab?.id!, {
        type: "start",
        id: tab?.url
      });
      break;
    case "encrypt":
      browser.tabs.sendMessage(tab?.id!, {
        type: "encrypt",
        id: tab?.url
      });
      break;
    case "decrypt":
      browser.tabs.sendMessage(tab?.id!, {
        type: "decrypt",
        id: tab?.url
      });
      break;
    default:
      return;
  }
});
