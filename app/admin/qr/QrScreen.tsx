"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { getQrCode } from "@/app/actions";
import { KLASSES, type Klass } from "@/lib/config";

// 수업 시작할 때 이 화면만 띄워두면 30초마다 새 QR로 바뀌어요.
export default function QrScreen() {
  const [klass, setKlass] = useState<Klass>("start-daily");
  const [svg, setSvg] = useState("");
  const [left, setLeft] = useState(30);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("vella_qr_klass") as Klass | null;
      if (saved && saved in KLASSES) setKlass(saved);
    } catch {}
  }, []);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const code = await getQrCode(klass);
      if (!alive || !code) return;
      const url = `${location.origin}/check?k=${klass}&t=${code}`;
      setSvg(await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#12405c", light: "#ffffff" } }));
      setLeft(30 - (Math.floor(Date.now() / 1000) % 30));
    };
    refresh();
    const tick = setInterval(() => {
      const s = 30 - (Math.floor(Date.now() / 1000) % 30);
      setLeft(s);
      if (s === 30) refresh();
    }, 1000);
    return () => {
      alive = false;
      clearInterval(tick);
    };
  }, [klass]);

  const pick = (k: Klass) => {
    setKlass(k);
    try { localStorage.setItem("vella_qr_klass", k); } catch {}
  };

  return (
    <div className="space-y-6 pt-6 text-center">
      <div className="flex flex-wrap justify-center gap-2">
        {(Object.keys(KLASSES) as Klass[]).map((k) => (
          <button
            key={k}
            onClick={() => pick(k)}
            className={`rounded-full px-4 py-2 font-bold ${k === klass ? "bg-sky-deep text-white" : "bg-white text-sky-ink"}`}
          >
            {KLASSES[k]}
          </button>
        ))}
      </div>
      <div className="card mx-auto max-w-md">
        <p className="font-jua text-3xl text-sky-ink">{KLASSES[klass]} 출석 체크 ☁️</p>
        <p className="mt-1 text-slate-500">휴대폰 카메라로 찍으면 출석 스티커가 붙어요</p>
        <div className="mx-auto mt-4 aspect-square w-full max-w-sm" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-3 text-sm text-slate-400">{left}초 후 새 QR로 바뀌어요</p>
      </div>
    </div>
  );
}
