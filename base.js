// inspired by http://ryanmorr.com/using-mutation-observers-to-watch-for-element-availability/
const listeners = [];
const doc = window.document;
const MutationObserver =
  window.MutationObserver || window.WebKitMutationObserver;
let observer = null;

const check = () => {
  // Check the DOM for elements matching a stored selector
  listeners.map(listener => {
    const elements = doc.querySelectorAll(listener.selector);
    elements.forEach(ele => {
      if (!ele.ready) {
        ele.ready = true;
        listener.fn.call(ele, ele);
      }
    });
  });
};

const ready = (selector, fn) => {
  // Store the selector and callback to be monitored
  listeners.push({
    selector: selector,
    fn: fn
  });
  if (!observer) {
    // Watch for changes in the document
    observer = new MutationObserver(check);
    observer.observe(doc.documentElement, {
      childList: true,
      subtree: true
    });
  }
  // Check if the element is currently in the DOM
  check();
};

// Expose `ready`
window.customjsReady = ready;

// other
async function aesGcmEncrypt(plaintext, password) {
  const pwUtf8 = new TextEncoder().encode(password); // encode password as UTF-8
  const pwHash = await crypto.subtle.digest("SHA-256", pwUtf8); // hash the password

  const iv = crypto.getRandomValues(new Uint8Array(12)); // get 96-bit random iv

  const alg = { name: "AES-GCM", iv: iv }; // specify algorithm to use

  const key = await crypto.subtle.importKey("raw", pwHash, alg, false, [
    "encrypt"
  ]); // generate key from pw

  const ptUint8 = new TextEncoder().encode(plaintext); // encode plaintext as UTF-8
  const ctBuffer = await crypto.subtle.encrypt(alg, key, ptUint8); // encrypt plaintext using key

  const ctArray = Array.from(new Uint8Array(ctBuffer)); // ciphertext as byte array
  const ctStr = ctArray.map(byte => String.fromCharCode(byte)).join(""); // ciphertext as string
  const ctBase64 = btoa(ctStr); // encode ciphertext as base64

  const ivHex = Array.from(iv)
    .map(b => ("00" + b.toString(16)).slice(-2))
    .join(""); // iv as hex string

  return ivHex + ctBase64; // return iv+ciphertext
}

async function aesGcmDecrypt(ciphertext, password) {
  const pwUtf8 = new TextEncoder().encode(password); // encode password as UTF-8
  const pwHash = await crypto.subtle.digest("SHA-256", pwUtf8); // hash the password

  const iv = ciphertext
    .slice(0, 24)
    .match(/.{2}/g)
    .map(byte => parseInt(byte, 16)); // get iv from ciphertext

  const alg = { name: "AES-GCM", iv: new Uint8Array(iv) }; // specify algorithm to use

  const key = await crypto.subtle.importKey("raw", pwHash, alg, false, [
    "decrypt"
  ]); // use pw to generate key

  const ctStr = atob(ciphertext.slice(24)); // decode base64 ciphertext
  const ctUint8 = new Uint8Array(
    ctStr.match(/[\s\S]/g).map(ch => ch.charCodeAt(0))
  ); // ciphertext as Uint8Array
  // note: why doesn't ctUint8 = new TextEncoder().encode(ctStr) work?

  const plainBuffer = await crypto.subtle.decrypt(alg, key, ctUint8); // decrypt ciphertext using key
  const plaintext = new TextDecoder().decode(plainBuffer); // decode password from UTF-8

  return plaintext; // return the plaintext
}

var password = "";
var persist = false;
customjsReady("._fl2", e => {
  var pass = document.createElement("input");
  pass.type = "password";
  pass.id = "password";
  pass.addEventListener("input", x => {
    password = pass.value;
    if (!persist) {
      return;
    }
    decryptAll();
  });
  e.prepend(pass);

  var persistcb = document.createElement("input");
  persistcb.type = "checkbox";
  persistcb.id = "persistcb";
  persistcb.addEventListener("change", () => {
    persist = persistcb.checked;
    if (persist) {
      decryptAll();
    } else {
      uncryptAll();
    }
  });
  e.prepend(persistcb);
});

function decrypt(x) {
  var r = x.dataset.received;
  if (r === undefined) {
    r = x.innerText;
    x.dataset.received = x.innerText;
  }
  x.innerText = r;
  if (password === "") {
    return;
  }
  try {
    aesGcmDecrypt(r, password).then(str => (x.innerText = str));
  } catch (e) {
    x.innerText = r;
  }
}

function onEach(selector, f) {
  var xs = document.querySelectorAll(selector);
  var i;
  for (i = 0; i < xs.length; ++i) {
    f(xs[i]);
  }
}

function decryptAll() {
  onEach("._58nk", x => {
    decrypt(x);
  });
}
function uncryptAll() {
  onEach("._58nk", x => {
    x.innerText = x.dataset.received;
  });
}

customjsReady("._58nk", x => {
  if (persist) {
    decrypt(x);
  }
});

function hook() {
  var oldsend = require("MercuryMessageActions").prototype.send;
  require("MercuryMessageActions").prototype.send = function(i, j, k) {
    if (password === "") {
      return oldsend.call(this, i, j, k);
    }
    aesGcmEncrypt(i.body, password).then(str => {
      i.body = str;
      return oldsend.call(this, i, j, k);
    });
  };
}

function hooker() {
  try {
    hook();
  } catch (e) {
    setTimeout(hooker, 10);
  }
}
hooker();

document.addEventListener("keydown", e => {
  if (e.keyCode === 18) {
    document.getElementById("persistcb").checked = false;
    persist = false;
    decryptAll();
  }
});

document.addEventListener("keyup", e => {
  if (e.keyCode === 18 && !persist) {
    uncryptAll();
  }
});

var keys = {};
var cur_url = document.location.href;
(function changeKeyOnWindowChange() {
  if (document.location.href !== cur_url) {
    keys[cur_url] = password;
    cur_url = document.location.href;
    password = keys[cur_url] || "";
    document.getElementById("password").value = password;
  }
  setTimeout(changeKeyOnWindowChange, 100);
})();
