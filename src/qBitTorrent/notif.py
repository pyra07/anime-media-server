# Fires off a notification when a torrent has finished downloading.
import json
import sys
from discord_webhook import DiscordWebhook


with open('../../profile.json') as f:
    webhook = json.load(f)
    webhook = webhook['webhook']
f.close()

# print arguments

webhook = DiscordWebhook(url=webhook, rate_limit_retry=True,
                         content=sys.argv[1])
response = webhook.execute()
