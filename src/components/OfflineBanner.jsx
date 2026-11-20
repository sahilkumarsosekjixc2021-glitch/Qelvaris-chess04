import { useEffect, useState } from "react";
import { getLang } from "../i18n/i18n";

const TXT = {
  en: "You are offline. Your games are safe on this device. Cloud backup and sign-in will work again when the internet is back.",
  es: "Estás sin conexión. Tus partidas están a salvo en este dispositivo. La copia en la nube y el inicio de sesión volverán cuando regrese internet.",
  hi: "आप ऑफ़लाइन हैं। आपके गेम इस डिवाइस पर सुरक्षित हैं। इंटरनेट लौटने पर क्लाउड बैकअप और साइन-इन फिर काम करेंगे।",
};

// Calm notice instead of mysterious errors when the connection drops.
export default function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine !== false);
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  if (online) return null;
  return <div role="status" style={{ background: "#3a2a05", color: "#f7b538", padding: "8px 14px", textAlign: "center", fontSize: 14 }}>{TXT[getLang()] || TXT.en}</div>;
}
