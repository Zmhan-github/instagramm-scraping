const fs = require('fs')
const request = require('request-promise')
const cheerio = require('cheerio')


const USERNAME = 'biznesbastau'
// const USERNAME = 'learn_ninja'
const BASE_URL = `https://www.instagram.com/${USERNAME}`


const options = {
  uri: BASE_URL,
  transform(body) {
    return cheerio.load(body);
  }
};

request(options)
  .then($ => {
    let script = $('script[type="text/javascript"]').eq(3).html()
    let scriptRegEx = /window._sharedData = (.+);/g.exec(script)
    let { entry_data: { ProfilePage: { [0]: { graphql: { user } } } } } = JSON.parse(scriptRegEx[1])

    //object.entry_data.ProfilePage[0].graphql.user

    let { entry_data: { ProfilePage: { [0]: { graphql: { user: { edge_owner_to_timeline_media: { edges } } } } } } } = JSON.parse(scriptRegEx[1])
    let posts = []
    for(let edge of edges) {
      const { node } = edge
      posts.push({
        id: node.id,
        shortcode: node.shortcode,
        timestamp: node.taken_at_timestamp,
        likes: node.edge_liked_by.count,
        comments: node.edge_media_to_comment.count,
        video_views: node.video_view_count,
        caption: node.edge_media_to_caption.edges[0].node.text,
        image_url: node.display_url
      })
    }

    let instagramData = {
      followers: user.edge_followed_by.count,
      following: user.edge_follow.count,
      uploads: user.edge_owner_to_timeline_media.count,
      fullName: user.full_name,
      pictureUrl: user.profile_pic_url_hd,
      posts
    }
    fs.writeFileSync('./public/user_info.json', JSON.stringify(instagramData), 'utf-8')
    return posts;
  })
  .then(posts => {
    const postReq = []
    posts.forEach(({ comments, shortcode }) => {
      options.uri = `https://www.instagram.com/p/${shortcode}`
      postReq.push(request(options))
    })
    return Promise.all(postReq)
  })
  .then(_$ => {
    const commetns = []
    _$.forEach($ => {
      let script = $('script[type="text/javascript"]').eq(3).html()
      let scriptRegEx = /window._sharedData = (.+);/g.exec(script)
      let { entry_data : { PostPage: { [0]: { graphql: { shortcode_media: { edge_media_to_comment: { edges } } } } } } } = JSON.parse(scriptRegEx[1])
      edges.forEach(({ node }) => {
        commetns.push({
          username: node.owner.username,
          text: node.text
        })
      })
    })
    
    return commetns;
  })
  .then(allCommets => {
    const comments = []
    const telRegExp = /((8|\+7)[\- ]?)(\(?\d{3}\)?[\- ]?)?[\d\- ]{7,10}/;
  
    allCommets.forEach(({ text, username }) => {
      if (!(text.search(telRegExp) === -1)) {
        comments.push({
          username: username,
          text: text
        })
      }
    })
    fs.writeFileSync('./public/comments_body.json', JSON.stringify(comments), 'utf-8')
  })
  .then(() => {
    const telRegExp = /((8|\+7|7)[\- ]?)(\(?\d{3}\)?[\- ]?)?[\d\- ]{7,10}/;
    const contents = fs.readFileSync('./public/comments_body.json', 'utf-8')
    const commentsBad = JSON.parse(contents);
    let commentsGood = []
    commentsBad.forEach(({ text, username }) => {
      let bobyText = text.trim();
      let telStart = bobyText.search(telRegExp);
      let number = '';
      for(let i = telStart; i < bobyText.length; i++) {
        if (isNaN(Number(bobyText[i]))) {
          continue;
        } else {
          number += bobyText[i]
        }
      }
      commentsGood.push({
        username: username,
        number: number.replace(/\s+/g, '')
      })
    })
    fs.writeFileSync('./public/comments_number.json', JSON.stringify(commentsGood), 'utf-8')
  })
  .catch(err => {
    console.log(err)
  })