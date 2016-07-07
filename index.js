exports.use = function () {
	return function (args) {
		if (!args.message && !args.mention) {
			throw new Error('Message or Mention must be set')
		}

		var commands = null
		if (args.commands) {
			commands = require(args.commands)
		} else {
			throw new Error('Commands not found!')
		}

		this.use({
			userStream: {
				path: 'user',
				method: 'stream'
			},
			sendMessage: {
				path: 'direct_messages/new',
				method: 'post'
			},
			sendMention: {
				path: 'statuses/update',
				method: 'post'
			}
		})

		if (args.message) {
			var stream = this.userStream({stringify_friend_ids: true, with: 'following'})

			stream.on('direct_message', event => {
				if (event.direct_message) {
					var mesaj = event.direct_message
					var sender_id = mesaj.sender.id_str // eslint-disable-line camelcase
					var sender_name = mesaj.sender.screen_name // eslint-disable-line camelcase
					var text = mesaj.text

					var check = send(control(text, commands))

					if (check !== null && check.message !== false) {
						this.sendMessage({user_id: sender_id, screen_name: sender_name, text: check.reply}).then(result => { // eslint-disable-line camelcase
							if (!result.recipient_id) {
										// houston we have a problem
							}
						}).catch(err => {
							console.log(err)
						})
					}
				}
			})

			stream.on('disconnect', disconnectMessage => {
				console.log(disconnectMessage)
				stream.start()
			})
		}

		if (args.mention) {
			var id = args.mention
			var mention = this.tweetStream({follow: id})

			mention.on('tweet', twet => {
				if (twet.in_reply_to_user_id === id) {
					var text = twet.text
					var check = send(control(text, commands))
					if (check !== null && check.mention !== false) {
						var reply = {}
						if (twet.in_reply_to_status_id === null) {
							reply.status = `@${twet.user.screen_name} ${check.reply}`
						} else {
							reply.in_reply_to_status_id = twet.in_reply_to_status_id
							reply.status = `@${twet.user.screen_name} ${check.reply}`
						}

						this.sendMention(reply).then(result => {
							if (!result.created_at) {
								// houston we have a problem
							}
						}).catch(err => {
							console.log(err)
						})
					}
				}
			})

			mention.on('disconnect', disconnectMessage => {
				console.log(disconnectMessage)
				mention.start()
			})
		}
	}
}

function control(msg, commands) {
	return commands.map(command => {
		if ((command.texts.map(text => {
			return msg.includes(text)
		})).indexOf(true) !== -1) {  // eslint-disable-line no-negated-condition
			return {
				status: true,
				reply: command.reply(),
				message: command.message,
				mention: command.mention
			}
		}
		return {
			status: false,
			reply: null
		}
	})
}

function send(que) {
	return (que.find(result => {
		return result.status === true && result.reply !== null
	}) || null)
}
