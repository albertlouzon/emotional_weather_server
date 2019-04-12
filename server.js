const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const axios = require("axios");
var querystring = require("querystring");
var cors = require("cors");
var DomParser = require("dom-parser");
var JSON = require("json-circular-stringify");
var rssSource = "http://www.oecd.org/";
var rssSourceEnd = "/index.xml";
var rssGuardian = "https://www.theguardian.com/world/";
var fs = require("fs");
var NaturalLanguageUnderstandingV1 = require("ibm-watson/natural-language-understanding/v1.js");
require("dotenv").config({ silent: true }); //  optional

var requiredUrl = "";
var corsOptions = {
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.listen(8000, () => {
  console.log(
    "Jsuis le server et je viens de START AIE AIE AIE CA VA CHIER J AI AUCUNE DATA A TE MONTRER JE SUIS LA JUSTE POUR TE CASSER LES COUILLES"
  );
});

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.use(bodyParser.json());

var short_analyses = [];
var finalDetail = {
  score: 0,
  icon: "",
  mainCategories: [],
  mainKeywords: [],
  listOfAllUrls: []
};
var articlesUrl = [];

// ENDPOINT FOR POST

app.post("/sendNewsUrl/:country", function(request, response) {
  const country = request.params.country;

  console.log(country);

  var url = `${rssGuardian}${country}/rss`;
  //  var url = `${rssSource}${body}${rssSourceEnd}`
  console.log("A son of a bitch requested this country ", url);
  axios
    .get(url)
    .then(function(template) {
      fetchLinksTemplate(template.data);
      const metaObject = [];
      for (var i = 0; i <= Object.keys(articlesUrl).length; i++) {
        if (articlesUrl[i]) {
          var nlu = new NaturalLanguageUnderstandingV1({
            version: "2018-11-16"
          });
          var options = {
            url: articlesUrl[i].trim(),
            features: {
              concepts: {},
              categories: {},
              // entities: {},
              // keywords: {},
              sentiment: {}
            }
          };
          nlu.analyze(options, function(err, res) {
            if (err) {
              console.log(err);
              return;
            }
            // console.log(res);
            metaObject.push(res);
            if (metaObject.length === Object.keys(articlesUrl).length - 1) {
              setTimeout(() => {
                extractDataFromWatsonResponse(metaObject);
                dataCalculation();
                response.json(finalDetail);
                // console.log('end extractDataFromWatsonResponse', short_analyses)
              }, 1000);
            }
          });
        }
      }
    })
    .catch(function(error) {
      console.log(error);
      response.send("this link is broken, give me another link");
    });
});

// Extracting links from html templates

function fetchLinksTemplate(htmlTemplate) {
  console.log("invoed");
  articlesUrl = [];
  var parser = new DomParser();

  const doc = parser.parseFromString(htmlTemplate, "text/html");
  const linkContainer = doc.getElementsByTagName("item");

  for (var i = 0; i <= linkContainer.length; i++) {
    if (linkContainer[i]) {
      const bigText = linkContainer[i].innerHTML;
      // console.log('section ', bigText)
      if (bigText.includes("<link/>https://www.theguardian.com")) {
        let linkFlag = false;
        for (var letter = 0; letter <= bigText.length; letter++) {
          if (
            linkFlag === false &&
            bigText[letter - 4] === "l" &&
            bigText[letter - 3] === "i" &&
            bigText[letter - 2] === "n" &&
            bigText[letter - 1] === "k" &&
            bigText[letter] === "/"
          ) {
            if (
              articlesUrl.find(
                link =>
                  link ===
                  bigText.substring(
                    letter + 2,
                    bigText.indexOf("description") - 1
                  )
              )
            ) {
            } else {
              articlesUrl.push(
                bigText.substring(
                  letter + 2,
                  bigText.indexOf("description") - 1
                )
              );
            }
          }
        }
      }
    }
  }
}

// Data logic
function extractDataFromWatsonResponse(metaObject) {
  short_analyses = [];
  finalDetail = {
    score: 0,
    icon: "",
    mainCategories: [],
    mainKeywords: [],
    listOfAllUrls: []
  };
  // here we extract raw material from the object. And we start filtering some arrays if they are too long.
  metaObject.forEach(analyse => {
    short_analyses.push({
      generalInfo: analyse["sentiment"]["document"],
      categories: analyse["categories"][0],
      keywords: [
        analyse["concepts"][0],
        analyse["concepts"][1],
        analyse["concepts"][2],
        analyse["concepts"][3]
      ],
      url: analyse["retrieved_url"]
    });
  });
}

function dataCalculation() {
  let sumOfscore = 0;
  const scoreDivider = short_analyses.length;
  let commonCategories = [];
  short_analyses.forEach(article => {
    // score
    article.categories.articleScore = article.generalInfo.score;
    finalDetail.listOfAllUrls.push(article.url);
    sumOfscore = sumOfscore + article.generalInfo.score;
    // categories filtered into mainCategories
    const currentCategories = article.categories.label;
    const articlesSharingCategories = short_analyses.filter(
      x => x.categories.label === currentCategories && x.url !== article.url
    );
    if (articlesSharingCategories.length > 1) {
      commonCategories.push(articlesSharingCategories);
    }
  });
  var r = commonCategories.filter(((r = {}), a => !(2 - (r[a] = ++r[a] | 0))));
  // mainCategories calculation of the global score and retrieving global label. HEre we gonna get rid of keywords and url
  // HIGH CATEGORY SCORE MEANS HIGH RELIABILITY THAT THIS ARTICLE IS ABOUT THIS CATEGORY
  r.forEach(commonCategory => {
    //saving the label
    const categoryName = commonCategory[0]["categories"]["label"];
    let sumOfscore2 = 0;
    const scoreDivider2 = commonCategory.length;
    const urls = [];
    commonCategory.forEach(article => {
      sumOfscore2 = sumOfscore2 + article["categories"]["score"];
      urls.push({
        url: article["url"],
        score: article["categories"]["articleScore"]
      });
    });
    const categoryReliability = sumOfscore2 / scoreDivider2;
    if (urls.length > 5) {
      urls.length = 5;
    }
    finalDetail.mainCategories.push({
      label: categoryName,
      score: categoryReliability,
      listOfUrls: urls
    });
  });
  finalDetail.score = sumOfscore / scoreDivider;
  // this.changeGlobalScoreColor(this.finalDetail.score)
  finalDetail.mainCategories.forEach(cat => {
    let categoryScore = 0;
    const scoreDivider3 = cat.listOfUrls.length;

    cat.listOfUrls.forEach(article => {
      categoryScore = categoryScore + article.score;
    });
    const total = categoryScore / scoreDivider3;
    cat["globalCatScore"] = total;
  });
  console.log("end dataCalcultation, finalDetail:", finalDetail);
  finalDetail.listOfAllUrls.length = 7;
  return finalDetail;
}
