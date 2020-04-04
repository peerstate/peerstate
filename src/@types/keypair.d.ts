declare module "keypair" {
  type Keypair = { public: string; private: string };
  const keypair = () => Keypair;
  export default keypair;
}
