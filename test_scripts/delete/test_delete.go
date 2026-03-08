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
	secret := []byte("spinvel_interview_secret_key_32_chars_min")
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
		"title":       "Test Delete Question",
		"description": "To be deleted",
	})
	qReq, _ := http.NewRequest("POST", "http://localhost:8080/api/v1/questions", bytes.NewBuffer(qReqBody))
	qReq.Header.Set("Authorization", authHeader)
	qReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	qResp, err := client.Do(qReq)
	if err != nil {
		fmt.Println("Error creating question:", err)
		return
	}
	defer qResp.Body.Close()
	qBody, _ := ioutil.ReadAll(qResp.Body)
	fmt.Println("Create Question Resp:", string(qBody))

	var qData map[string]interface{}
	json.Unmarshal(qBody, &qData)
	qID := qData["id"].(string)

	// 2. Create Session
	sReqBody, _ := json.Marshal(map[string]string{
		"title":           "Test Delete Session",
		"candidate_email": "test@example.com",
		"candidate_name":  "Test Last",
	})
	sReq, _ := http.NewRequest("POST", "http://localhost:8080/api/v1/sessions", bytes.NewBuffer(sReqBody))
	sReq.Header.Set("Authorization", authHeader)
	sReq.Header.Set("Content-Type", "application/json")

	sResp, err := client.Do(sReq)
	if err != nil {
		fmt.Println("Error creating session:", err)
		return
	}
	defer sResp.Body.Close()
	sBody, _ := ioutil.ReadAll(sResp.Body)
	fmt.Println("Create Session Resp:", string(sBody))

	var sData map[string]interface{}
	json.Unmarshal(sBody, &sData)
	sID := sData["session_id"].(string)

	// 3. Delete Question
	fmt.Println("Deleting Question:", qID)
	delQReq, _ := http.NewRequest("DELETE", "http://localhost:8080/api/v1/questions/"+qID, nil)
	delQReq.Header.Set("Authorization", authHeader)
	delQResp, _ := client.Do(delQReq)
	fmt.Println("Delete Question Status:", delQResp.StatusCode)

	// 4. Delete Session
	fmt.Println("Deleting Session:", sID)
	delSReq, _ := http.NewRequest("DELETE", "http://localhost:8080/api/v1/sessions/"+sID, nil)
	delSReq.Header.Set("Authorization", authHeader)
	delSResp, _ := client.Do(delSReq)
	fmt.Println("Delete Session Status:", delSResp.StatusCode)
}
