/**
 * Test script to verify Cloudinary access and URL generation
 */

import { generateSignedUrl } from "~/lib/cloudinary";
import { env } from "~/env.js";

async function testCloudinaryAccess() {
  console.log("🧪 Testing Cloudinary Access\n");

  // Test 1: Check environment variables
  console.log("1. Environment Variables:");
  console.log(`   CLOUDINARY_CLOUD_NAME: ${env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing'}`);
  console.log(`   CLOUDINARY_API_KEY: ${env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   CLOUDINARY_API_SECRET: ${env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing'}\n`);

  // Test 2: Test URL generation with a sample public ID
  console.log("2. URL Generation Test:");
  try {
    // Use the actual public ID from your logs
    const testPublicId = "dms/SNezb64n5kGz/1759419866709-workorders_report__1_.pdf";
    console.log(`   Testing with public ID: ${testPublicId}`);
    
    const generatedUrl = generateSignedUrl(testPublicId);
    console.log(`   Generated URL: ${generatedUrl}\n`);

    // Test 3: Try to fetch the URL
    console.log("3. URL Access Test:");
    try {
      const response = await fetch(generatedUrl, { 
        method: 'HEAD',
        headers: {
          'User-Agent': 'DMS-Test/1.0'
        }
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      console.log(`   Content-Type: ${response.headers.get('content-type')}`);
      console.log(`   Content-Length: ${response.headers.get('content-length')}`);
      
      if (response.ok) {
        console.log("   ✅ URL is accessible");
      } else {
        console.log("   ❌ URL is not accessible");
        
        // Test with direct URL (no signature)
        console.log("\n4. Testing Direct URL (no signature):");
        const directUrl = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/raw/upload/${testPublicId}`;
        console.log(`   Direct URL: ${directUrl}`);
        
        const directResponse = await fetch(directUrl, { 
          method: 'HEAD',
          headers: {
            'User-Agent': 'DMS-Test/1.0'
          }
        });
        
        console.log(`   Direct Status: ${directResponse.status} ${directResponse.statusText}`);
        if (directResponse.ok) {
          console.log("   ✅ Direct URL works - signature issue detected");
        } else {
          console.log("   ❌ Direct URL also fails - file or permissions issue");
        }
      }
      
    } catch (fetchError) {
      console.error(`   ❌ Fetch failed:`, fetchError);
    }
    
  } catch (urlError) {
    console.error(`   ❌ URL generation failed:`, urlError);
  }

  console.log("\n📊 Test Complete");
}

// Run the test
if (require.main === module) {
  testCloudinaryAccess().catch(console.error);
}

export { testCloudinaryAccess };

