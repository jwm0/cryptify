import React from "react";

export const Input: React.FC<{ handleSubmit: (value: string) => void }> = ({
  handleSubmit,
}) => {
  const [name, setName] = React.useState("");

  return (
    <form
      style={{
        position: "fixed",
        width: "100%",
        height: "100vh",
        backgroundColor: "rgba(255, 255, 255, 0.7)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        top: 0,
        left: 0,
      }}
      onSubmit={() => {
        handleSubmit(name);
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          padding: "20px 40px",
          borderRadius: "20px",
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
        />
        <input type="submit" hidden />
      </div>
    </form>
  );
};
