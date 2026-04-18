FROM jrottenberg/ffmpeg:6.1-ubuntu AS base

# Install Go
RUN apt-get update && \
    apt-get install -y wget ca-certificates && \
    wget -q https://go.dev/dl/go1.22.2.linux-amd64.tar.gz && \
    tar -C /usr/local -xzf go1.22.2.linux-amd64.tar.gz && \
    rm go1.22.2.linux-amd64.tar.gz && \
    rm -rf /var/lib/apt/lists/*

ENV PATH="/usr/local/go/bin:${PATH}"

WORKDIR /app

# Download dependencies first (cached layer)
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build
COPY . .
RUN go build -o /ms1-media-processor ./cmd/main.go

EXPOSE 8081

CMD ["/ms1-media-processor"]
