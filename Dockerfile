FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PATH="/root/.foundry/bin:$PATH"

RUN apt-get update && apt-get install -y \
    curl git build-essential ca-certificates python3 \
    && rm -rf /var/lib/apt/lists/*

RUN curl -L https://foundry.paradigm.xyz | bash && foundryup

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY contracts ./contracts
COPY scripts ./scripts
COPY pancake/package*.json ./pancake/
RUN cd pancake && npm install
COPY pancake ./pancake

COPY start.sh ./start.sh
RUN chmod +x start.sh

EXPOSE 8545

CMD ["bash", "start.sh"]
