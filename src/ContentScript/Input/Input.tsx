import React from "react";

import { Modal } from "../Modal";

export type InputProps = {
  handleSubmit: (value: string) => void;
  type: "inbound" | "outbound";
};

export const Input: React.FC<InputProps> = ({ type, handleSubmit }) => {
  const [name, setName] = React.useState("");

  return (
    <Modal
      header="Type in conversation partner name"
      description={
        type === "outbound"
          ? "Press enter to generate a handshake then paste and submit it in the chat."
          : "You've received a handshake. Type in your partner name to accept or press ESC to decline."
      }
      handleSubmit={() => {
        handleSubmit(name);
      }}
    >
      <input
        style={{
          padding: "10px 20px",
          borderRadius: "20px",
          fontSize: 18,
          fontWeight: "bold",
        }}
        type="text"
        value={name}
        onChange={({ target: { value } }) => {
          setName(value);
        }}
        autoFocus
      />
      <input type="submit" hidden />
    </Modal>
  );
};
