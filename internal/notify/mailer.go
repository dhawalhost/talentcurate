package notify

import (
	"fmt"
	"log"
)

// SendInvitation stimulates sending an email invitation to a participant.
func SendInvitation(name string, email string, joinUrl string, role string) {
	log.Printf("\n=======================================================\n")
	log.Printf("[EMAIL SENT] To: %s (%s)\n", name, email)
	log.Printf("Subject: You're invited to a Spinvel Interview (%s)\n", role)
	log.Printf("Body:\n")
	log.Printf("Hello %s,\n\nYou have been invited to join a technical interview session.\n", name)
	log.Printf("Please click the link below to join your secure room:\n")
	log.Printf(">> %s <<\n", joinUrl)
	log.Printf("=======================================================\n\n")

	// Print to stdout explicitly to make it obvious during a demo
	fmt.Printf("[MOCK EMAIL] Invitation sent to %s (%s). Link: %s\n", name, email, joinUrl)
}
