// Alphabet without ambiguous characters (0/O, 1/I/l)
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomId(length = 6) {
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  let id = "";
  for (let i = 0; i < length; i++) {
    id += CHARS[arr[i] % CHARS.length];
  }
  return id;
}

export function isValidRoomId(id) {
  return typeof id === "string" && /^[A-Z2-9]{6}$/.test(id);
}

export function getRoomIdFromURL() {
  const path = window.location.pathname.slice(1).toUpperCase();
  return isValidRoomId(path) ? path : null;
}
