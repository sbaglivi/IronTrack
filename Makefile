DEPLOY_HOST := glacier
COMPOSE := docker compose

.PHONY: build deploy release logs status backup

build:
	docker build --platform linux/arm64 --tag sbaglivi/irontrack:latest --push .

deploy:
	ssh -t $(DEPLOY_HOST) 'cd /home/sbaglivi/apps/irontrack && $(COMPOSE) pull && $(COMPOSE) up -d'

release: build deploy

logs:
	ssh $(DEPLOY_HOST) 'cd /home/sbaglivi/apps/irontrack && $(COMPOSE) logs -f irontrack'

status:
	ssh $(DEPLOY_HOST) 'cd /home/sbaglivi/apps/irontrack && $(COMPOSE) ps && $(COMPOSE) logs --tail=20 irontrack'

ssh:
	ssh $(DEPLOY_HOST) && cd /home/sbaglivi/apps/irontrack

backup:
	ssh $(DEPLOY_HOST) 'cp /home/sbaglivi/apps/irontrack/data/irontrack.db /home/sbaglivi/apps/irontrack/data/irontrack.db.$$(date +%Y%m%d)'
