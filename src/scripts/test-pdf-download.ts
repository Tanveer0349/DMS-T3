/**
 * Test script to diagnose PDF download issues
 * This script helps identify common problems with PDF viewing/downloading
 */

import { generateSignedUrl } from "~/lib/cloudinary";
import { env } from "~/env.js";

interface DiagnosticResult {
  test: string;
  status: "PASS" | "FAIL" | "WARNING";
  message: string;
  details?: any;
}

async function runPDFDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  // Test 1: Check Cloudinary configuration
  try {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      results.push({
        test: "Cloudinary Configuration",
        status: "FAIL",
        message: "Missing Cloudinary environment variables",
        details: {
          cloudName: !!env.CLOUDINARY_CLOUD_NAME,
          apiKey: !!env.CLOUDINARY_API_KEY,
          apiSecret: !!env.CLOUDINARY_API_SECRET
        }
      });
    } else {
      results.push({
        test: "Cloudinary Configuration",
        status: "PASS",
        message: "Cloudinary environment variables are set"
      });
    }
  } catch (error) {
    results.push({
      test: "Cloudinary Configuration",
      status: "FAIL",
      message: "Error checking Cloudinary configuration",
      details: error
    });
  }

  // Test 2: Test signed URL generation
  try {
    const testPublicId = "test-document.pdf";
    const signedUrl = generateSignedUrl(testPublicId);
    
    if (signedUrl && signedUrl.includes("res.cloudinary.com")) {
      results.push({
        test: "Signed URL Generation",
        status: "PASS",
        message: "Signed URL generation works",
        details: { url: signedUrl.substring(0, 100) + "..." }
      });
    } else {
      results.push({
        test: "Signed URL Generation",
        status: "FAIL",
        message: "Invalid signed URL generated",
        details: { url: signedUrl }
      });
    }
  } catch (error) {
    results.push({
      test: "Signed URL Generation",
      status: "FAIL",
      message: "Error generating signed URL",
      details: error
    });
  }

  // Test 3: Check route accessibility
  try {
    const testUrl = "/api/download-secure?versionId=test&inline=true";
    results.push({
      test: "Route Accessibility",
      status: "WARNING",
      message: "Manual test required - try accessing download routes with valid version IDs",
      details: { testUrl }
    });
  } catch (error) {
    results.push({
      test: "Route Accessibility",
      status: "FAIL",
      message: "Error testing route accessibility",
      details: error
    });
  }

  return results;
}

// Function to display results in a readable format
export function displayDiagnosticResults(results: DiagnosticResult[]): void {
  console.log("\n=== PDF Download Diagnostics ===\n");
  
  results.forEach((result, index) => {
    const statusIcon = result.status === "PASS" ? "✅" : result.status === "FAIL" ? "❌" : "⚠️";
    console.log(`${index + 1}. ${statusIcon} ${result.test}: ${result.message}`);
    
    if (result.details) {
      console.log(`   Details:`, result.details);
    }
    console.log("");
  });

  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  const warnings = results.filter(r => r.status === "WARNING").length;

  console.log(`Summary: ${passed} passed, ${failed} failed, ${warnings} warnings\n`);

  if (failed > 0) {
    console.log("❌ Issues found that need attention:");
    results.filter(r => r.status === "FAIL").forEach(r => {
      console.log(`   - ${r.test}: ${r.message}`);
    });
  }

  if (warnings > 0) {
    console.log("\n⚠️ Manual tests required:");
    results.filter(r => r.status === "WARNING").forEach(r => {
      console.log(`   - ${r.test}: ${r.message}`);
    });
  }
}

// Export for use in other scripts or debugging
export { runPDFDiagnostics, type DiagnosticResult };

// Run diagnostics if called directly
if (require.main === module) {
  runPDFDiagnostics().then(displayDiagnosticResults).catch(console.error);
}

