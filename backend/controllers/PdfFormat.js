import PDFDocument from "pdfkit";
import fs from "fs";
import crypto from "crypto";
import path from "node:path"; // Use node:path for cleaner imports

const ConvertUserDataToPdf = async (userData) => {
  if (!userData || !userData.userId) {
    throw new Error("Invalid user data: userId missing");
  }

  // ✅ 1. CHANGE: Save directly in "uploads" (not "resumes" subfolder)
  // This ensures express.static("uploads") can find it easily
  const resumesDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(resumesDir)) {
    fs.mkdirSync(resumesDir, { recursive: true });
  }

  // ✅ 2. FILE NAME
  const fileName = crypto.randomBytes(32).toString("hex") + ".pdf";
  const filePath = path.join(resumesDir, fileName);

  // ✅ 3. CREATE PDF
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const pageWidth = doc.page.width;
  const leftX = 40;
  const rightX = pageWidth / 2 + 10;
  let y = 40;

  /* ===== HEADER ===== */
  doc.fontSize(22).font("Helvetica-Bold")
    .text(userData.userId.name || "", leftX, y);

  doc.fontSize(12).font("Helvetica")
    .text(userData.userId.email || "", leftX, y + 30)
    .text(userData.userId.username || "", leftX, y + 45);

  /* 🖼️ IMAGE TOP-RIGHT */
  if (userData.userId.profilePicture) {
    const imagePath = path.join(
      process.cwd(),
      "uploads",
      userData.userId.profilePicture
    );
    if (fs.existsSync(imagePath)) {
      doc.image(imagePath, pageWidth - 120, 40, { width: 80 });
    }
  }

  y += 90;

  /* ===== LEFT COLUMN ===== */
  doc.fontSize(14).font("Helvetica-Bold").text("ABOUT ME", leftX, y);
  doc.moveDown(0.5);
  doc.fontSize(10).font("Helvetica")
    .text(userData.bio || "Passionate full stack developer.", { width: 230 });

  y += 80;

  doc.fontSize(14).font("Helvetica-Bold").text("SKILLS", leftX, y);
  doc.moveDown(0.5);
  doc.fontSize(10)
    .text("JavaScript, Node.js, React")
    .text("MongoDB, SQL, REST APIs")
    .text("DSA, DBMS, OS");

  /* ===== RIGHT COLUMN ===== */
  let ry = 150;
  doc.fontSize(14).font("Helvetica-Bold").text("PROJECTS", rightX, ry);
  ry += 25;

  if (Array.isArray(userData.pastWork)) {
    userData.pastWork.forEach((p) => {
      doc.fontSize(11).font("Helvetica-Bold")
        .text(p.company || "Project", rightX, ry);
      ry += 15;
      doc.fontSize(10).font("Helvetica")
        .text(p.position || "", { width: 230 });
      ry += 30;
    });
  }

  doc.end();

  // ✅ 4. CHANGE: Return only the filename
  // Because your frontend does: `${Base_Url}/${filePath}`
  // If filePath is "abc.pdf", it becomes "http://localhost:9080/abc.pdf"
  // Your server serves "uploads" as root, so it will find it!
  return `${fileName}`; 
};

export default ConvertUserDataToPdf;