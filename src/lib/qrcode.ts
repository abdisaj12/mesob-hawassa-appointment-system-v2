import QRCode from "qrcode";

/**
 * Generates a QR code (as a data URL) encoding a booking's reference number.
 * Used both on-screen (confirmation cards) and in the printable slip.
 */
export async function generateBookingQR(reference: string): Promise<string> {
  return QRCode.toDataURL(reference, {
    errorCorrectionLevel: "M", // use "H" if it'll be printed and handled a lot
    margin: 1,
    width: 180,
    color: {
      dark: "#1a2f6e",  // matches the app's brand navy
      light: "#ffffff",
    },
  });
}