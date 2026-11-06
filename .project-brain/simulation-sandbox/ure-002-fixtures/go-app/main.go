package main

import (
  "fmt"
  "os"
)

type ServerConfig struct {
  Port int
  Host string
}

func (s *ServerConfig) Validate() bool {
  return s.Port > 0
}

func StartServer(cfg ServerConfig) error {
  if !cfg.Validate() {
    return fmt.Errorf("invalid port")
  }
  return nil
}

func main() {
  fmt.Println("Starting Go Server")
}
