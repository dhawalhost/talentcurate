package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func main() {
	secret := []byte("talentcurate_interview_secret_key_32_chars_min")
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  "test-admin",
		"role": "admin",
		"name": "Admin",
		"exp":  time.Now().Add(time.Hour).Unix(),
	})
	tokenString, _ := token.SignedString(secret)
	authHeader := "Bearer " + tokenString

	// 1. Create Question
	qReqBody, _ := json.Marshal(map[string]string{
		"title":       "Original Question",
		"description": "Original Description",
	})
	qReq, _ := http.NewRequest("POST", "http://localhost:8080/api/v1/questions", bytes.NewBuffer(qReqBody))
	qReq.Header.Set("Authorization", authHeader)
	qReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	qResp, _ := client.Do(qReq)
	qBody, _ := ioutil.ReadAll(qResp.Body)
	qResp.Body.Close()

	var qData map[string]interface{}
	json.Unmarshal(qBody, &qData)
	qID := qData["id"].(string)

	fmt.Println("Created Question:", qID)

	// 2. Update Question
	qPutBody, _ := json.Marshal(map[string]string{
		"title":       "Updated Question Title",
		"description": "Updated Description text",
	})
	qPutReq, _ := http.NewRequest("PUT", "http://localhost:8080/api/v1/questions/"+qID, bytes.NewBuffer(qPutBody))
	qPutReq.Header.Set("Authorization", authHeader)
	qPutReq.Header.Set("Content-Type", "application/json")

	qPutResp, _ := client.Do(qPutReq)
	fmt.Println("Update Question Status:", qPutResp.StatusCode)

	// Clean up
	delQReq, _ := http.NewRequest("DELETE", "http://localhost:8080/api/v1/questions/"+qID, nil)
	delQReq.Header.Set("Authorization", authHeader)
	client.Do(delQReq)
}
