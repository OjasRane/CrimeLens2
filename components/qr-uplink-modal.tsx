"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, RadioTower, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import { formatCaseName } from "@/lib/liveblocks";
import { triggerHaptic } from "@/lib/haptics";
import { useInvestigationStore } from "@/store/use-investigation-store";

export function QRUplinkModal() {
  const isOpen = useInvestigationStore((state) => state.isQrModalOpen);
  const setQrModalOpen = useInvestigationStore((state) => state.setQrModalOpen);
  const searchParams = useSearchParams();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  const roomId = formatCaseName(searchParams.get("case") ?? "");
  const uplinkUrl = useMemo(() => {
    if (!roomId) return "";
    if (!origin) return `/uplink?case=${encodeURIComponent(roomId)}`;
    return `${origin}/uplink?case=${encodeURIComponent(roomId)}`;
  }, [origin, roomId]);

  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setQrModalOpen(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, setQrModalOpen]);

  useEffect(() => {
    if (!isOpen) setCopied(false);
  }, [isOpen]);

  async function copyUplink() {
    if (!uplinkUrl) return;

    await navigator.clipboard.writeText(uplinkUrl);
    triggerHaptic("light");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-[140] flex items-center justify-center overflow-y-auto bg-black/65 p-2 backdrop-blur-md sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setQrModalOpen(false);
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-uplink-title"
            className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-none border-4 border-black bg-[#F4F4F0] p-4 font-mono text-black shadow-[8px_8px_0_black] sm:p-5 dark:border dark:border-[#426D79] dark:bg-[#08242D] dark:text-[#F4F1DC] dark:shadow-[4px_4px_0_#011015]"
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 6 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <header className="flex items-start justify-between gap-4 border-b-4 border-black pb-4 dark:border-b dark:border-[#426D79]">
              <div>
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#D22B2B] dark:text-[#32D6A0]">
                  <RadioTower aria-hidden="true" size={15} />
                  Mobile field channel
                </p>
                <h2
                  id="qr-uplink-title"
                  className="mt-2 text-xl font-black uppercase leading-tight"
                >
                  Deploy Field Agent
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                aria-label="Close QR uplink"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-none border-2 border-black bg-white shadow-[2px_2px_0_black] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none dark:border dark:border-[#426D79] dark:bg-[#144453] dark:text-[#F4F1DC] dark:shadow-none"
              >
                <X aria-hidden="true" size={20} strokeWidth={3} />
              </button>
            </header>

            <div className="py-5">
              {roomId ? (
                <>
                  <div className="mx-auto w-fit max-w-full border-4 border-black bg-[#F4F4F0] p-2 shadow-[4px_4px_0_black] sm:p-3 dark:border-[#426D79] dark:shadow-[4px_4px_0_#011015]">
                    <QRCodeSVG
                      value={uplinkUrl}
                      size={232}
                      className="h-auto w-[min(232px,68vw)]"
                      level="M"
                      marginSize={1}
                      bgColor="#F4F4F0"
                      fgColor="#031820"
                      title={`Field uplink for ${roomId}`}
                    />
                  </div>

                  <p className="mt-5 text-center text-xs font-black uppercase tracking-[0.14em]">
                    Scan to join case channel
                  </p>
                  <p className="mt-2 break-all text-center text-[10px] uppercase leading-relaxed text-black/55 dark:text-[#6F8F96]">
                    {uplinkUrl}
                  </p>
                </>
              ) : (
                <div className="border-4 border-[#D22B2B] bg-white p-5 text-center text-xs font-black uppercase leading-relaxed tracking-[0.12em] text-[#D22B2B] shadow-[4px_4px_0_black] dark:border dark:border-[#FFD45A] dark:bg-[#031820] dark:text-[#FFD45A] dark:shadow-[4px_4px_0_#011015]">
                  [ CREATE OR JOIN A CASE BEFORE DEPLOYING AN UPLINK ]
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={copyUplink}
              disabled={!roomId}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-none border-4 border-black bg-black px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[4px_4px_0_#D22B2B] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-45 dark:border dark:border-[#32D6A0] dark:bg-[#144453] dark:text-[#32D6A0] dark:shadow-[4px_4px_0_#011015]"
            >
              {copied ? (
                <Check aria-hidden="true" size={17} />
              ) : (
                <Copy aria-hidden="true" size={17} />
              )}
              {!roomId
                ? "[ CASE REQUIRED ]"
                : copied
                  ? "[ UPLINK COPIED ]"
                  : "[ COPY UPLINK ]"}
            </button>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
