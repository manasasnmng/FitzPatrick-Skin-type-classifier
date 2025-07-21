const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const resultDiv = document.getElementById('result');
const captureBtn = document.getElementById('captureBtn');
const retakeBtn = document.getElementById('retakeBtn');
const quizDiv = document.getElementById('quiz');

let latestLandmarks = null;
let cameraRunning = true;
let skinResult = "";

function classifyFitzpatrick(r, g, b) {
  const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

  let introText = "Based on your detected skin type, here are some personalized skincare insights tailored just for you. These are derived from your skin's natural response to sun exposure and pigmentation.";

  if (brightness > 200) {
    return {
      label: "Type I: Very fair",
      description: `${introText}\n\n• ☀️ Extremely sensitive to sunlight – sunburns happen fast!\n• 🧴 Always use a strong SPF 50+ sunscreen.\n• 🧬 Your skin has very little melanin, which means almost no tanning ability.\n• 👩‍🦰 Common features: freckles, red or blonde hair, light eyes.\n\n📝 Tip: Carry a hat and sunglasses when outdoors. UV protection is your best friend!`,
    };
  } else if (brightness > 180) {
    return {
      label: "Type II: Fair",
      description: `${introText}\n\n• 🌤️ High risk of sunburn – protect yourself early.\n• 🧴 Use a high SPF (30–50) even on cloudy days.\n• 🧬 Your skin has a little melanin but still struggles to tan.\n• 👱‍♀️ Common traits: light hair, blue/green eyes.\n\n📝 Tip: Moisturize daily and consider adding vitamin C serum for glow!`,
    };
  } else if (brightness > 130) {
    return {
      label: "Type III: Medium",
      description: `${introText}\n\n• 🌞 Moderate risk of sunburn – especially after long exposure.\n• 🧴 SPF 30 is generally enough, reapply if staying out long.\n• 🧬 You have a balanced melanin level, so you can tan slowly.\n• 👩 Common traits: brown hair, hazel eyes.\n\n📝 Tip: Exfoliate weekly to maintain brightness and prevent patchy tanning.`,
    };
  } else if (brightness > 85) {
    return {
      label: "Type IV: Olive",
      description: `${introText}\n\n• 🌅 Tans easily and rarely burns.\n• 🧴 Use SPF 15–30 to avoid long-term sun damage.\n• 🧬 Richer melanin means better natural protection.\n• 👩🏽‍🦰 Common traits: dark hair and eyes, warm undertones.\n\n📝 Tip: Consider antioxidants in your skincare to prevent pigmentation over time.`,
    };
  } else if (brightness > 60) {
    return {
      label: "Type V: Brown",
      description: `${introText}\n\n• ☀️ Almost never burns, tans beautifully.\n• 🧴 Still use SPF 15–30 to protect from aging and dark spots.\n• 🧬 You have high melanin, offering strong UV defense.\n• 🌏 Common among Southeast Asian and Middle Eastern skin tones.\n\n📝 Tip: Hydration is key—opt for gel-based moisturizers and brightening serums.`,
    };
  } else if (brightness > 40){
    return {
      label: "Type VI: Dark brown/Black",
      description: `${introText}\n\n• 🌞 Highly resistant to sunburn.\n• 🧴 SPF 15–30 is still essential to prevent hyperpigmentation and premature aging.\n• 🧬 Very high melanin levels give your skin its rich tone and strong natural sun shield.\n• 🌍 Common in African and Afro-Caribbean descent.\n\n📝 Tip: Even skin tone care is important—look for niacinamide or kojic acid-based products.`,
    };
  }
}



function getColorFrom(landmarks, idx) {
  const x = Math.floor(landmarks[idx].x * canvas.width);
  const y = Math.floor(landmarks[idx].y * canvas.height);
  const pixel = ctx.getImageData(x, y, 1, 1).data;
  return [pixel[0], pixel[1], pixel[2]];
}

const faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

faceMesh.onResults(results => {
  if (!cameraRunning) return;
  if (results.multiFaceLandmarks.length > 0) {
  latestLandmarks = results.multiFaceLandmarks[0];

  // Check full face visibility using left (234) and right (454) cheek landmarks
  const leftX = latestLandmarks[234].x;
  const rightX = latestLandmarks[454].x;
  const faceWidth = Math.abs(rightX - leftX);

  // Heuristic: if width < 0.2, assume incomplete face
  if (faceWidth < 0.2) {
    resultDiv.innerText = "⚠️ Please align your full face in the frame.";
    latestLandmarks = null; // prevent capture
  } else {
    resultDiv.innerText = "Face aligned! Tap Capture to analyze.";
  }
} else {
  latestLandmarks = null;
  resultDiv.innerText = "Align your face inside the box, then tap Capture.";
}

});


// Check for camera permission and availability first
navigator.mediaDevices.getUserMedia({ video: true })
  .then((stream) => {
    // Permission granted - proceed to set up the camera
    const camera = new Camera(video, {
      onFrame: async () => {
        await faceMesh.send({ image: video });
      },
      width: 640,
      height: 480,
    });
    camera.start();
  })
  .catch((err) => {
    console.error("Camera access error:", err);
    resultDiv.innerText = "🚫 Camera not found. Check your permissions.";
    captureBtn.disabled = true;
    captureBtn.style.opacity = "0.5";
    captureBtn.style.cursor = "not-allowed";
  });


captureBtn.onclick = () => {
  if (!latestLandmarks) {
    resultDiv.innerText = "Face not aligned. Try again.";
    return;
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const indices = [1, 10, 152, 234, 454];
  const colors = indices.map(idx => getColorFrom(latestLandmarks, idx));
  const avgColor = colors.reduce((acc, [r, g, b]) => [acc[0] + r, acc[1] + g, acc[2] + b], [0, 0, 0]).map(v => Math.floor(v / colors.length));
  skinResult = classifyFitzpatrick(...avgColor);

  const resultData = classifyFitzpatrick(...avgColor);
skinResult = resultData.label;

resultDiv.innerHTML = `<strong>${resultData.label}</strong><br/><p>Submit the below form to learn more</p>`;

  cameraRunning = false;
  captureBtn.style.display = 'none';
  retakeBtn.style.display = 'inline-block';

  // Show Quiz
  quizDiv.innerHTML = `
    <form id="quizForm" style="margin-top:20px;">
      <p>Name:</p>
      <input type="text" name="name" placeholder="Enter your name" required style="width:100%;padding:8px;">
      <p>Age:</p>
      <input type="number" name="age" placeholder="Enter your age" min="1" required style="width:100%;padding:8px;">
      <p>Gender:</p>
      <select name="gender" required style="width:100%;padding:8px;">
        <option value="">Select Gender</option>
        <option>Male</option>
        <option>Female</option>
        <option>Other</option>
      </select>
      <p>Skin Type:</p>
      <select name="skinType" required style="width:100%;padding:8px;">
        <option value="">Select Skin Type</option>
        <option>Oily</option>
        <option>Dry</option>
        <option>Normal</option>
        <option>Combinational</option>
      </select>
      <p>Previous skin issues?</p>
          <div class="radio-group">
            <input type="radio" id="historyYes" name="history" value="yes" required />
            <label for="historyYes">Yes</label>
            <input type="radio" id="historyNo" name="history" value="no" required />
            <label for="historyNo">No</label>
          </div>

          <p>Want to consult specific issue?</p>
          <div class="radio-group">
            <input type="radio" id="consultYes" name="consult" value="yes" required />
            <label for="consultYes">Yes</label>
            <input type="radio" id="consultNo" name="consult" value="no" required />
            <label for="consultNo">No</label>
          </div>

          <div id="issueBox" style="display:none;">
            <input type="text" name="specificIssue" placeholder="Describe your issue..." />
          </div>
          <label class="block mb-2 font-semibold" for="contact">Contact Number <span class="text-red-500">*</span></label>
          <input type="tel" id="contact" name="contact" required class="w-full px-3 py-2 border border-gray-300 rounded mb-4" placeholder="Enter your contact number" />  
          <span id="contactError" class="text-red-500 text-sm hidden">Please enter a valid 10-digit contact number.</span>

          <label class="block mb-2 font-semibold" for="email">Email ID (Optional)</label>
          <input type="email" id="email" name="email" class="w-full px-3 py-2 border border-gray-300 rounded mb-4" placeholder="Enter your email" />
          <button type="submit" disabled>Submit</button>
        </form>`;

  // Show/Hide specific issue input
  document.querySelectorAll('input[name="consult"]').forEach(radio => {
    radio.addEventListener('change', function () {
      document.getElementById('issueBox').style.display = this.value === 'yes' ? 'block' : 'none';
      checkFormCompletion(); // Re-check after toggling visibility
    });
  });

  const quizForm = document.getElementById('quizForm');
  const submitBtn = document.querySelector('button[type="submit"]'); // Fix the submit button reference

  // Validation function
function checkFormCompletion() {
  const contactInput = quizForm.elements["contact"];
  const contactError = document.getElementById("contactError");

  function isValidContactNumber(number) {
    return /^\d{10}$/.test(number.trim());
  }

  const name = quizForm.elements["name"].value.trim();
  const age = quizForm.elements["age"].value.trim();
  const gender = quizForm.elements["gender"].value;
  const skinType = quizForm.elements["skinType"].value;
  const history = quizForm.querySelector('input[name="history"]:checked');
  const consult = quizForm.querySelector('input[name="consult"]:checked');
  const contact = contactInput.value.trim();
  const consultValue = consult ? consult.value : null;
  const specificIssue = quizForm.elements["specificIssue"]?.value.trim();

  // Contact number validation
  const contactValid = isValidContactNumber(contact);
  if (!contactValid) {
    contactError.classList.remove("hidden");
  } else {
    contactError.classList.add("hidden");
  }

  const allFilled = name && age && gender && skinType && history && consult &&
    contactValid &&
    (consultValue === 'no' || (consultValue === 'yes' && specificIssue));

  submitBtn.disabled = !allFilled;
}


  // Attach listeners to all form inputs
  quizForm.querySelectorAll('input, select, textarea').forEach(input => {
    input.addEventListener('input', checkFormCompletion);
    input.addEventListener('change', checkFormCompletion);
  });

  // Submission handler
  quizForm.addEventListener('submit', function (e) {
    e.preventDefault();
    document.getElementById("loadingMessage").style.display = "flex";

submitBtn.disabled = true; // Prevent double submission

    const formData = new FormData(this);
    const data = {};
    formData.forEach((value, key) => { data[key] = value; });
    data["skinResult"] = skinResult;
    data["imageBase64"] = canvas.toDataURL();

    if (parseInt(data.age) <= 0 || isNaN(parseInt(data.age))) {
      alert('Please enter a valid positive age.');
      return;
    }

    console.log(data);

    fetch('https://script.google.com/macros/s/AKfycbxg-OW7wRA88pKOBFDQbpwKoFALVp_YIc3OwmmLMy-62hiyz-0t9avrn0ZeynglYRn6Xw/exec', {
      redirect: "follow",
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    })
      .then(response => response.text())
      .then(responseText => {
        try {
          const parsed = JSON.parse(responseText);
          if (parsed.status === "success") {
            document.getElementById("loadingMessage").style.display = "none";
            resultDiv.innerHTML = `<strong>${resultData.label}</strong><br/><pre style="text-align:left; white-space:pre-wrap;">${resultData.description}</pre>`;
            alert('Form submitted successfully!');
            document.getElementById('quizForm').reset();
            quizDiv.hidden=true;
            quizDiv.style.visibility='hidden';
            quizDiv.innerHTML = '';
          } else {
            alert('Submission failed. Please try again.');
          }
        } catch (e) {
          console.error('Invalid response:', responseText);
          alert('Submission failed. Please try again.');
        }
      })
      .catch(error => {
        console.error('Error:', error);
        alert('Error submitting form. Please check your connection.');
      });
  });



};

retakeBtn.onclick = () => {
  // Restart camera logic
  cameraRunning = true;
  resultDiv.innerText = "Align your face inside the box, then tap Capture.";
  
  // Show Capture Button again
  captureBtn.style.display = 'inline-block';
  retakeBtn.style.display = 'none';

  // Clear previous result and quiz
  quizDiv.hidden = false;
  quizDiv.style.visibility = 'visible';
  quizDiv.innerHTML = '';

  resultDiv.innerHTML = '';

  // Optionally clear canvas too
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};
