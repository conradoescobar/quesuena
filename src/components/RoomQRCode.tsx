'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, QrCode, Share2 } from 'lucide-react';

interface RoomQRCodeProps {
  roomCode: string;
}

export function RoomQRCode({ roomCode }: RoomQRCodeProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Build the join URL
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join/${roomCode}`
    : `/join/${roomCode}`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Unete a Adivina la Cancion',
          text: `Unete a mi sala con el codigo: ${roomCode}`,
          url: joinUrl,
        });
      } catch (err) {
        // User cancelled or error
        console.log('Share cancelled or failed:', err);
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(joinUrl);
      alert('Link copiado al portapapeles!');
    }
  };

  return (
    <>
      {/* Button to open QR modal */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        <QrCode className="w-5 h-5" />
        <span className="hidden sm:inline">Invitar Jugadores</span>
      </button>

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-gray-900 border border-white/20 rounded-2xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Invitar Jugadores</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Room Code */}
            <div className="text-center mb-6">
              <p className="text-gray-400 text-sm mb-1">Codigo de la sala</p>
              <p className="text-4xl font-mono font-bold text-green-400 tracking-widest">
                {roomCode}
              </p>
            </div>

            {/* QR Code */}
            <div className="bg-white p-4 rounded-xl mx-auto w-fit mb-6">
              <QRCodeSVG
                value={joinUrl}
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>

            {/* Instructions */}
            <p className="text-gray-400 text-center text-sm mb-6">
              Escanea el QR o comparte el link para unirte
            </p>

            {/* Share button */}
            <button
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-xl transition-colors"
            >
              <Share2 className="w-5 h-5" />
              Compartir Link
            </button>

            {/* URL display */}
            <div className="mt-4 p-3 bg-white/5 rounded-lg">
              <p className="text-gray-500 text-xs mb-1">Link directo:</p>
              <p className="text-gray-300 text-sm break-all font-mono">
                {joinUrl}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
