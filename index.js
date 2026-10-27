
require("dotenv").config();

const cron = require("node-cron");
const http = require("http");

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain"
  });

  res.end("Morning News Bot is running.");

}).listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


const Parser = require("rss-parser");
const { GoogleGenAI } = require("@google/genai");

const parser = new Parser();


const apiKeys = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2
].filter(Boolean);

if (apiKeys.length === 0) {
  throw new Error("No Gemini API keys are configured.");
}


// ================================
// GREETINGS
// ================================

const morningGreetings = [
  "🌅 Good morning! Here's your quick look at the biggest stories from yesterday.",
  "☀️ Good morning! Let's catch up on what happened around the world yesterday.",
  "🌍 Morning update! Here are the important stories from yesterday.",
  "📰 Good morning! Here's what you need to know this morning."
];
function getRandomGreeting() {

  const randomIndex =
    Math.floor(Math.random() * morningGreetings.length);

  return morningGreetings[randomIndex];
}

// ================================
// DATE FUNCTIONS
// ================================

function getNigeriaDate(daysOffset = 0) {

  const now = new Date();

  const nigeriaDate = new Date(
    now.toLocaleString("en-US", {
      timeZone: "Africa/Lagos"
    })
  );

  nigeriaDate.setDate(
    nigeriaDate.getDate() + daysOffset
  );

  return nigeriaDate.toISOString().split("T")[0];
}


function getNigeriaYesterday() {
  return getNigeriaDate(-1);
}


// ================================
// NEWS SOURCES
// ================================

const feeds = {

  nigeria: [
    "https://www.channelstv.com/feed/"
  ],

  world: [
    "https://feeds.bbci.co.uk/news/world/rss.xml"
  ],

  football: [
    "https://feeds.bbci.co.uk/sport/football/rss.xml"
  ],

  technology: [
    "https://feeds.bbci.co.uk/news/technology/rss.xml"
  ],

  economy: [
    "https://feeds.bbci.co.uk/news/business/rss.xml"
  ]

};

// ================================
// NEWS IMAGES
// ================================

const newsImages = [
  "https://i.ibb.co/nqBBKstT/images-2.jpg",
  "https://i.ibb.co/S4nNSCsk/image-9e4f28f8.jpg",
  "https://i.ibb.co/Y79Wdky9/images-1.jpg",
  "https://i.ibb.co/Xf8tgH9V/images.jpg"
];

function getRandomImage() {

  const randomIndex =
    Math.floor(Math.random() * newsImages.length);

  return newsImages[randomIndex];
}

// ================================
// GET RSS FEED
// ================================

async function getFeed(url) {

  try {

    const feed = await parser.parseURL(url);

    return feed.items.map((item) => ({

      title: item.title,

      description:
        item.contentSnippet ||
        item.content ||
        item.summary ||
        "",

      date:
        item.isoDate ||
        item.pubDate ||
        "",

      link:
        item.link ||
        ""

    }));

  } catch (error) {

    console.log("Feed error:", url);

    return [];

  }

}


// ================================
// COLLECT NEWS
// ================================


async function collectNews(targetDate, beforeHour = null) {
  console.log("Researching news...");
  console.log("Target date:", targetDate);

  if (beforeHour !== null) {
    console.log(`Only including news published before ${beforeHour}:00 Nigeria time.`);
  }

  const results = {};

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  for (const category of Object.keys(feeds)) {
    results[category] = [];

    for (const feedUrl of feeds[category]) {
      const articles = await getFeed(feedUrl);

      for (const article of articles) {
        if (!article.date) continue;

        const publishedDate = new Date(article.date);

        if (Number.isNaN(publishedDate.getTime())) continue;

        const parts = formatter.formatToParts(publishedDate);
        const values = {};

        for (const part of parts) {
          values[part.type] = part.value;
        }

        const articleDate =
          `${values.year}-${values.month}-${values.day}`;

        const articleHour = Number(values.hour);

        if (articleDate !== targetDate) continue;

        // For the 5 PM post, exclude news published at or after 5 PM.
        if (beforeHour !== null && articleHour >= beforeHour) {
          continue;
        }

        results[category].push(article);
      }
    }
  }

  return results;
}


// ================================
// CREATE MORNING POST
// ================================

async function createMorningPost(news) {

  console.log("Creating morning post with Gemini...");
  const greeting = getRandomGreeting();

  const prompt = `

You are a professional morning news editor.

Today is ${getNigeriaDate()}.

The target news date is ${getNigeriaYesterday()}.

The news below was collected from RSS feeds.

Create a short Facebook morning news briefing about important events that happened yesterday.

IMPORTANT:

- Only use information contained in the supplied news.
- Do not invent facts.
- Do not add stories that are not supplied.
- Select the most important stories.
- Mention the source name when possible.
- Keep the language simple and natural.
- No Markdown.
- No URLs.
- No website addresses.
- No hashtags.
- Maximum 450 words.
- Nigeria News MUST come first.
- Give exactly 2 important Nigeria stories.
- Give exactly 2 World stories.
- Give exactly 2 Football stories.
- Give exactly 2 Technology stories.
- Give exactly 2 Economy/Business stories.

Use exactly this structure:

${greeting}

🇳🇬 NIGERIA NEWS:

2 important Nigeria stories.

🌍 WORLD NEWS:

2 important stories.

⚽ FOOTBALL:

2 important football stories.

💻 TECHNOLOGY:

2 important technology stories.

💰 ECONOMY:

2 important economy/business stories.

End with one short positive morning message.

NEWS DATA:

NIGERIA:
${JSON.stringify(news.nigeria, null, 2)}

WORLD:
${JSON.stringify(news.world, null, 2)}

FOOTBALL:
${JSON.stringify(news.football, null, 2)}

TECHNOLOGY:
${JSON.stringify(news.technology, null, 2)}

ECONOMY:
${JSON.stringify(news.economy, null, 2)}

`;

  return generateWithGemini(prompt);

}

// ================================
// CREATE EVENING POST
// ================================
async function createEveningPost(news) {
  console.log("Creating evening news post with Gemini...");

  const greeting = [
    "🌆 Good evening! Here are today's important updates.",
    "📰 Good evening! Catch up on the biggest stories of the day.",
    "🌍 Your evening news update is here. Here is what happened today.",
    "☀️ As the day winds down, here are the stories you need to know."
  ];

  const selectedGreeting =
    greeting[Math.floor(Math.random() * greeting.length)];

  const prompt = `
You are a professional news editor preparing a 5 PM news briefing for Nigeria.

Today's date in Nigeria is ${getNigeriaDate()}.

The news below was collected from RSS feeds.

Create a concise Facebook and WhatsApp evening news briefing covering events published TODAY, from the morning through the afternoon, before 5:00 PM Nigeria time.

IMPORTANT:
- Only use information contained in the supplied news.
- Do not invent facts or add stories that are not supplied.
- Do not include articles published on previous dates.
- Do not include articles published at or after 5:00 PM Nigeria time.
- Select the most important available stories.
- Mention the source name when possible.
- Use simple, natural English.
- No Markdown.
- No URLs or website addresses.
- No hashtags.
- Maximum 450 words.
- Nigeria News MUST come first.
- Give exactly 2 Nigeria stories.
- Give exactly 2 World stories.
- Give exactly 2 Football stories.
- Give exactly 2 Technology stories.
- Give exactly 2 Economy/Business stories.
- If a category contains fewer than 2 suitable stories, do not invent stories. Briefly state that fewer verified updates were available for that category.

Use this structure:

${selectedGreeting}

🇳🇬 NIGERIA NEWS:

Important stories from today.

🌍 WORLD NEWS:

Important stories from today.

⚽ FOOTBALL:

Important football stories from today.

💻 TECHNOLOGY:

Important technology stories from today.

💰 ECONOMY:

Important economy/business stories from today.

End with one short positive evening message.

NEWS DATA:

NIGERIA:
${JSON.stringify(news.nigeria, null, 2)}

WORLD:
${JSON.stringify(news.world, null, 2)}

FOOTBALL:
${JSON.stringify(news.football, null, 2)}

TECHNOLOGY:
${JSON.stringify(news.technology, null, 2)}

ECONOMY:
${JSON.stringify(news.economy, null, 2)}
`;

  return generateWithGemini(prompt);
}


// ================================
// GEMINI GENERATOR
// ================================


async function generateWithGemini(prompt) {
  let lastError;

  for (const [keyIndex, apiKey] of apiKeys.entries()) {
    const aiClient = new GoogleGenAI({
      apiKey: apiKey
    });

    // Try the current key up to 3 times.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(
          `Using Gemini API key ${keyIndex + 1}, attempt ${attempt}/3...`
        );

        const response = await aiClient.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt
        });

        const post = response.candidates?.[0]?.content?.parts
          ?.filter(part => part.text)
          .map(part => part.text)
          .join("")
          .trim();

        if (!post) {
          throw new Error("Gemini returned an empty response.");
        }

        console.log(
          `Gemini API key ${keyIndex + 1} succeeded.`
        );

        return post;

      } catch (error) {
        lastError = error;

        const status = error.status || error.code;

        console.error(
          `Gemini key ${keyIndex + 1} failed on attempt ${attempt}:`,
          status || error.message
        );

        // Switch keys immediately for errors unlikely to
        // be fixed by retrying the same key.
        const permanentKeyError =
          status === 400 ||
          status === 401 ||
          status === 403;

        if (permanentKeyError) {
          console.log("Switching to the next API key.");
          break;
        }

        // Retry temporary errors twice more.
        if (attempt < 3) {
          const waitTime = attempt * 10000;

          console.log(
            `Waiting ${waitTime / 1000} seconds before retry...`
          );

          await new Promise(resolve => {
            setTimeout(resolve, waitTime);
          });
        }
      }
    }

    if (keyIndex < apiKeys.length - 1) {
      console.log("Trying the next Gemini API key...");
    }
  }

  throw new Error(
    `All Gemini API keys failed. Last error: ${
      lastError?.message || "Unknown error"
    }`
  );
}



// ================================
// POST IMAGE TO FACEBOOK
// ================================

async function postToFacebook(message, imageUrl) {

  console.log("\nPosting image to Facebook...");

  const pageId =
    process.env.FACEBOOK_PAGE_ID;

  const accessToken =
    process.env.FACEBOOK_ACCESS_TOKEN;

  if (!pageId || !accessToken) {

    throw new Error(
      "Facebook Page ID or access token is missing."
    );
  }

  const response = await fetch(
    `https://graph.facebook.com/${pageId}/photos`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({

        url: imageUrl,

        caption: message,

        access_token: accessToken

      })
    }
  );

  const data = await response.json();

  if (!response.ok) {

    throw new Error(
      `Facebook API Error: ${JSON.stringify(data)}`
    );
  }

  console.log(
    "Facebook image post successful!"
  );

  console.log(
    "Post ID:",
    data.id
  );

  return data;
}


// ================================
// POST IMAGE TO WHATSAPP
// ================================

async function postToWhatsApp(message, imageUrl) {

  console.log("\nPosting image to WhatsApp Channel...");

  const channelId =
    process.env.WHATSAPP_CHANNEL_ID;

  const token =
    process.env.WHAPI_TOKEN;

  if (!channelId || !token) {

    throw new Error(
      "WhatsApp Channel ID or Whapi token is missing."
    );
  }

  const response = await fetch(
    "https://gate.whapi.cloud/messages/image",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },

      body: JSON.stringify({

        to: channelId,

        media: imageUrl,

        caption: message

      })
    }
  );

  const data = await response.json();

  if (!response.ok) {

    throw new Error(
      `WhatsApp API Error: ${JSON.stringify(data)}`
    );
  }

  console.log(
    "WhatsApp Channel image post successful!"
  );

  console.log(
    "WhatsApp response:",
    data
  );

  return data;
}

// ================================
// MORNING AND EVENING BOT
// ================================


async function publishNews(isEvening = false) {
  try {
    console.log("\n====================================");
    console.log(isEvening ? "EVENING NEWS BOT" : "MORNING NEWS BOT");
    console.log("====================================");

    const targetDate = isEvening
      ? getNigeriaDate()
      : getNigeriaYesterday();

    const news = await collectNews(
      targetDate,
      isEvening ? 17 : null
    );

    console.log("\nArticles found:");
    console.log("Nigeria:", news.nigeria.length);
    console.log("World:", news.world.length);
    console.log("Football:", news.football.length);
    console.log("Technology:", news.technology.length);
    console.log("Economy:", news.economy.length);

    const post = isEvening
      ? await createEveningPost(news)
      : await createMorningPost(news);

    const imageUrl = getRandomImage();

    console.log("\nSelected image:");
    console.log(imageUrl);

    console.log("\n====================================");
    console.log(isEvening ? "EVENING NEWS POST" : "MORNING NEWS POST");
    console.log("====================================");
    console.log(post);

    await postToFacebook(post, imageUrl);
    await postToWhatsApp(post, imageUrl);

    console.log("\n====================================");
    console.log("NEWS PUBLISHING FINISHED");
    console.log("====================================");
  } catch (error) {
    console.error("\nNEWS BOT ERROR:");
    console.error(error);
  }
}

async function runMorningBot() {
  return publishNews(false);
}

async function runEveningBot() {
  return publishNews(true);
}

// 7:00 AM Nigeria time: yesterday's news.
cron.schedule("0 7 * * *", () => {
  console.log("7:00 AM Nigeria time. Starting morning news bot...");
  runMorningBot();
}, {
  timezone: "Africa/Lagos"
});

// 5:00 PM Nigeria time: today's news published before 5 PM.
cron.schedule("0 17 * * *", () => {
  console.log("5:00 PM Nigeria time. Starting evening news bot...");
  runEveningBot();
}, {
  timezone: "Africa/Lagos"
});

