const https = require('https')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const hljs = require('highlight.js/lib/common')

const urlBase="https://cloudwu.github.io/lua53doc/"

function get(url) {
	const filename = crypto.createHash('md5').update(url.toLowerCase()).digest('hex')
	const cachePath = path.join(__dirname, 'caches', filename)
	if (fs.existsSync(cachePath)) {
		return new Promise((resolve, reject) => {
			fs.readFile(cachePath, { encoding: 'utf-8' }, (err, data) => {
				if (err) {
					return reject(err)
				}
				resolve(data)
			})
		})
	} else {
		return new Promise((resolve, reject) => {
			https.get(url, (res) => {
				if (res.statusCode !== 200) {
					if (res.statusCode === 301 || res.statusCode === 302) {
						return reject(new Error('redirect:' + res.headers['location']))
					}
					if (res.statusCode === 404) {
						return reject(new Error('notfound:' + url))
					}
					return reject(new Error('🥵  获取页面 返回状态码 *** ' + res.statusCode + '\n' + src))
				}
				res.setEncoding('utf8')
				let rawData = ''
				res.on('data', (chunk) => {
					rawData += chunk
				})
				res.on('end', () => {
					const cacheDir = path.join(__dirname, 'caches')
					if (!fs.existsSync(cacheDir)) {
						fs.mkdirSync(cacheDir)
					}
					fs.writeFileSync(cachePath, rawData)
					resolve(rawData)
				})
			})
		})
	}
}
var keys = {}
get(urlBase+'manual.html')
	.catch((e) => {
		console.error(e)
	})
	.then((html) => {
		var jsdom = require('jsdom')
		var dom = new jsdom.JSDOM(html)
		var window = dom.window
		var document = window.document
		var $ = require('jquery')(window)
		var $els = $('body>*')
		let index = 0
		const titleEl = ['H1', 'H2']
		let content = ''
		let indexes = []
		let docs = []
		keys = {}
		let title = ''
		let titleHtml = ''
		let filename = ''
		for (let i = 0; i < $els.length; i++) {
			const element = $els[i]
			if (element.nodeName == 'HR') {
				continue
			}
			if (titleEl.includes(element.nodeName)) {
				if (indexes.length > 0) {
					indexes[index - 1]['d'] = $(content).text().trim()
					docs.push({ index, content, titleHtml })
				}
				index++

				content = ''
				titleHtml = element.outerHTML
				title = element.textContent.trim()
				filename = `${index}.html`
				console.log(`整理第${index}篇文档: ${title}`)
				indexes.push({
					t: title,
					p: 'docs/' + filename,
					d: '',
				})

				const name = $(element.outerHTML).find('[name]').attr('name')
				keys[name] = filename
				continue
			}
			content += element.outerHTML
			const tags = $(content).find('[name]')
			if (tags.length > 0) {
				$(tags).each(function () {
					const name = $(this).attr('name')
					keys[name] = filename
				})
			}
		}
		docs.push({ index, content, titleHtml })
		docs.forEach((item) => {
			if(item.index>1)
			{
				writeDoc(item.index, item.content, item.titleHtml)
			}
		})
		fs.writeFileSync(path.join(__dirname, 'plugin', 'indexes.json'), JSON.stringify(indexes, null, 4))

		
		get(urlBase+'contents.html').catch((e)=>{
			console.error("❌ 目录请求失败")
		}).then((data)=>{
			const regTable=/<TABLE[^>]*?>([\s\S]*?)<\/TABLE>/g
			let m;
			if ((m = regTable.exec(data)) !== null) {
				let tableResult=m[0].replace(/manual\.html/g,'')
				const item=docs[0];
				item.content+='<H2><A NAME="index">索引</A></H2>'+tableResult
				writeDoc(item.index, item.content, item.titleHtml.replace(/src="logo\.gif"/,`src="../logo.png"`))
			}
		});
		
		console.info('🍺 OK 全部写出完成 ')
	})

function removeHtmlTag(content) {
	content = content.replace(/(?:<\/?[a-z][a-z1-6]{0,9}>|<[a-z][a-z1-6]{0,9} .+?>)/gi, '')
	return content
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&nbsp;/g, ' ')
}

function writeDoc(index, content, titleHtml) {
	const cacheDir = path.join(__dirname, 'plugin', 'docs')
	if (!fs.existsSync(cacheDir)) {
		fs.mkdirSync(cacheDir)
	}

	var jsdom = require('jsdom')
	var dom = new jsdom.JSDOM()
	var window = dom.window
	var $ = require('jquery')(window)

	let html = $(`<div>${titleHtml}${content}</div>`)
	let els = html.find('[href]')
	if (els.length > 0) {
		$(els).each(function () {
			const href = $(this).attr('href')
			if (href.startsWith('#')) {
				$(this).attr('href', keys[href.substring(1)] + href)
			}else{
				$(this).attr('href', urlBase+ href)
			}
		})
	}

	const codes = html.find('pre')
	if (codes.length > 0) {
		$(codes).each(function () {
			const highlightedCode = hljs.highlight(removeHtmlTag(this.outerHTML),{language:'lua'}).value 
			this.outerHTML='<pre><code class="lua hljs">' + highlightedCode + '</code></pre>'
		})
	}

	fs.writeFileSync(
		path.join(cacheDir, index.toString() + '.html'),
		`<!DOCTYPE html><html lang="zh_CN"><head><meta charset="UTF-8"><title>老大哥LUA文档</title>
<link rel="stylesheet" href="../static/lua.css" />
<link rel="stylesheet" href="../static/highlightjs/default.min.css" />
</head>
<body>${html[0].outerHTML}</body>
</html>`
	)
}
