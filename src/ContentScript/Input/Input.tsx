import React from "react";

import { Modal } from "../Modal";

export type InputProps = { handleSubmit: (value: string) => void };

export const Input: React.FC<InputProps> = ({ handleSubmit }) => {
  const [name, setName] = React.useState("");

  return (
    <Modal
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
