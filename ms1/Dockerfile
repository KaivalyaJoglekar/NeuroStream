FROM jrottenberg/ffmpeg:6.1-ubuntu AS base

ARG TARGETARCH

# Install Go
RUN apt-get update && \
    apt-get install -y wget ca-certificates && \
    GO_ARCH="${TARGETARCH}"; \
    if [ -z "${GO_ARCH}" ]; then GO_ARCH="amd64"; fi; \
    wget -q "https://go.dev/dl/go1.22.2.linux-${GO_ARCH}.tar.gz" -O /tmp/go.tgz && \
    tar -C /usr/local -xzf /tmp/go.tgz && \
    rm /tmp/go.tgz && \
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

# jrottenberg/ffmpeg sets an ffmpeg entrypoint; clear it so our binary starts directly.
ENTRYPOINT []
CMD ["/ms1-media-processor"]
