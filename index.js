const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { parse } = require('node-html-parser');

const postListFile = "post-list.json";
const postFolder = "posts";

const baseUrl = "https://syg.ma";

const commonHeaders = {
    Accept: "application/json, text/plain, */*",
    "Accept-Encoding": "identity",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    Host: "syg.ma",
    Pragma: "no-cache",
    "Range-Unit": "items",
    Referer: "https://syg.ma/posts",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "X-Requested-With": "XMLHttpRequest"
};

const chainPromises = (funcs) => {
    return funcs.reduce((promise, func) => {
        return promise.then((acc) => {
            return new Promise((resolve, reject) => {
                func().then((res) => {
                    resolve([...acc, ...res]);
                }, () => {
                    reject();
                });
            });
        });
    }, Promise.resolve([]));
};

function fetchPostList(from ,to) {
    console.log(`fetching next post list from ${from} to ${to}...`);
    return axios({
        url: baseUrl + "/posts",
        headers: Object.assign({}, commonHeaders, {
            Range: `${from}-${to}`
        })
    }).then((res) => {
        console.log(`success`);
        return res.data;
    }).catch((err) => {
        console.error(`error`);
        return [];
    });
}

function fetchAllPostList() {
    const startPost = 0;
    const endPost = 12000;
    const step = 100;
    const promiseCreators = [];
    for (let i = startPost; i < endPost; i += step) {
        promiseCreators.push(() => {
            return fetchPostList(i, i + step);
        });
    }
    console.log(`ready to fetch; start is ${startPost}, end is ${endPost}, step is ${step}`);
    return chainPromises(promiseCreators).then((res) => {
        console.log(`done; fetched ${res.length} posts`);
        return res;
    });
}

function fetchAndSaveAllPostList() {
    fetchAllPostList().then((res) => {
        fs.writeFile(postListFile, JSON.stringify(res), (err) => {
            if (err) throw err;
            console.log(`posts are written to file (${postListFile})`);
        });
    });
}

function extractPostContent(json) {
   return json.body;
}

function fetchPost(info) {
    const postPath = info.path;
    console.log(`fetching next post: ${postPath}...`);
    return axios({
        url: baseUrl + postPath,
        headers: Object.assign({}, commonHeaders)
    }).then((res) => {
        const data = {
            name: postPath,
            content: extractPostContent(res.data)
        };
        const parts = data.name.split("/");
        let directory = postFolder;
        for (let i = 0; i < parts.length - 1; i++) {
            directory = path.join(directory, parts[i]);
            if (!fs.existsSync(directory)){
                fs.mkdirSync(directory);
            }
        }
        try {
            fs.writeFile(path.join(postFolder, data.name + ".html"), data.content, () => {});
        } catch (e) {
            console.error(e);
        }
        return [data];
    }).catch((err) => {
        console.error(`error: `, err);
        return [];
    });
}

function fetchAllPosts() {
    return new Promise((resolve, reject) => {
        fs.readFile(postListFile, (err, data) => {
            if (err) {
                throw err;
            }
            const jsonData = JSON.parse(data);
            console.log(`loaded ${jsonData.length} posts from list; fetching...`);
            const promiseCreators = [];
            for (let i = 0; i < jsonData.length; i++) {
                promiseCreators.push(() => {
                    return fetchPost(jsonData[i]);
                });
            }
            return chainPromises(promiseCreators).then((res) => {
                resolve(res);
            });
        });
    });
}

function fetchAndSaveAllPosts() {
    if (!fs.existsSync(postFolder)){
        fs.mkdirSync(postFolder);
    }
    fetchAllPosts().then((res) => {
        console.log(`done fetch; loaded ${res.length} posts`);
    });
}

const args = process.argv.slice(2);

if (args[0] === "fetch-post-list") {
    fetchAndSaveAllPostList();
} else if (args[0] === "fetch-posts") {
    fetchAndSaveAllPosts();
} else {
    console.log(`wrong; try "node index.js fetch-post-list" or "node index.js fetch-posts"`)
}