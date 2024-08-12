import playwright from "playwright-chromium";
import dotenv from "dotenv";
import invariant from "tiny-invariant";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

dotenv.config();

invariant(process.env.GEO_LATITUDE, "secret GEO_LATITUDE is required");
invariant(process.env.GEO_LONGITUDE, "secret GEO_LONGITUDE is required");
invariant(process.env.ACCOUNT_EMAIL, "secret ACCOUNT_EMAIL is required");
invariant(process.env.ACCOUNT_PASSWORD, "secret ACCOUNT_PASSWORD is required");

const PUBLIC_HOLIDAYS = [
  "23 Jan 2023", // cuti bersama imlek
  "23 Mar 2023", // nyepi
  "23 Mar 2023", // cuti bersama nyepi
  "7 Apr 2023", // wafat isa almasih
  "19 Apr 2023", // idul fitri
  "20 Apr 2023", // idul fitri
  "21 Apr 2023", // idul fitri
  "24 Apr 2023", // idul fitri
  "25 Apr 2023", // idul fitri
  "27 Apr 2023", // cuti
  "1 Mei 2023", // hari buruh
  "18 Mei 2023", // kenaikan isa almasih
  "1 Jun 2023", // hari lahir pancasila
  "2 Jun 2023", // cuti bersama waisak
  "29 Jun 2023", // idul adha
  "19 Jul 2023", // tahun baru islam
  "17 Aug 2023", // kemerdekaan indonesia
  "28 Sep 2023", // maulid nabi muhammad
  "25 Dec 2023", // natal
  "26 Dec 2023", // cuti bersama natal
];

const mainLogic = async () => {
  const isHeadless =
    (process.env.HEADLESS_BROWSER ?? "true") === "true" ? true : false;

  const TODAY = dayjs().tz("Asia/Jakarta").format("D MMM YYYY");

  if (PUBLIC_HOLIDAYS.includes(TODAY)) {
    console.log("Today is public holiday, skipping check in/out...");
    return;
  }

  const browser = await playwright["chromium"].launch({
    headless: isHeadless,
  });

  const context = await browser.newContext({
    viewport: { width: 1080, height: 560 },
    geolocation: {
      latitude: Number(process.env.GEO_LATITUDE),
      longitude: Number(process.env.GEO_LONGITUDE),
    },
    permissions: ["geolocation"],
  });

  const page = await context.newPage();

  try {
    console.log("Opening login page...");
    await page.goto(
      "https://account.mekari.com/users/sign_in?client_id=TAL-73645&return_to=L2F1dGg_Y2xpZW50X2lkPVRBTC03MzY0NSZyZXNwb25zZV90eXBlPWNvZGUmc2NvcGU9c3NvOnByb2ZpbGU%3D"
    );

    // Ambil screenshot setelah halaman terbuka
    await page.screenshot({ path: 'after_page_load.png' });

    console.log("Filling in account email & password...");
    await page.waitForSelector("#user_email", { timeout: 90000 }); // Increased timeout to 90s
    await page.click("#user_email");
    await page.fill("#user_email", process.env.ACCOUNT_EMAIL);

    await page.press("#user_email", "Tab");
    await page.fill("#user_password", process.env.ACCOUNT_PASSWORD);

    console.log("Signing in...");
    await page.click("#new-signin-button");

    await page.waitForSelector('a[href="/employee/dashboard"]', { timeout: 90000 });

    console.log("Successfully Logged in...");
    // Implementasi logika tambahan
  } catch (error) {
    console.error("An error occurred:", error);

    // Ambil screenshot jika terjadi kesalahan
    await page.screenshot({ path: 'error_screenshot.png' });

    throw error;
  } finally {
    await browser.close();
  }
};

const MAX_RETRIES = 3;

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    await mainLogic();
    break; // exit the loop if successful
  } catch (error) {
    if (error.name === 'TimeoutError' && attempt < MAX_RETRIES) {
      console.log(`Attempt ${attempt} failed due to a timeout. Retrying...`);
    } else {
      console.error("Final attempt failed:", error);
      throw error; // re-throw the error if it's not a TimeoutError or if we've reached the max retries
    }
  }
}
